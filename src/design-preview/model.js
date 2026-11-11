import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../blocks/beginner.js';
import '../blocks/controller.js';
import '../blocks/robotics.js';
import { robotBlocks } from '../blocks/robot-devices.js';
import { editorToolbox } from '../blocks/beginner-toolbox.js';
import { FAST4WD_BOARD_ID } from '../boards/profiles.js';

export const TYPES = Object.freeze({ root: 'newmania_design_program', forever: 'newmania_design_forever', connect: 'newmania_design_ps4_connect', button: 'newmania_design_ps4_button' });
const field = (name, options) => ({ type: 'field_dropdown', name, options });
Blockly.defineBlocksWithJsonArray([
  { type:TYPES.root, message0:'Khi bắt đầu chương trình %1 %2', args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}], colour:'#e79b23', tooltip:'Chạy một lần mỗi lượt RUN. Đây là khối gốc duy nhất của chương trình.' },
  { type:TYPES.forever, message0:'Lặp mãi mãi %1 %2', args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}], previousStatement:null, colour:'#e79b23', tooltip:'Đặt cuối luồng chính, bên trong Khi bắt đầu chương trình.' },
  { type:TYPES.connect, message0:'Kết nối tay cầm PS4', previousStatement:null, nextStatement:null, colour:'#bd4d86', tooltip:'Chuẩn bị sử dụng tay cầm; không chờ, không tự ARM hay chạy motor. Ghép đôi Bluetooth với D1 là thao tác riêng.' },
  { type:TYPES.button, message0:'Nút PS4 %1 %2 ?', args0:[field('BUTTON', [['X','0'],['Tròn','1'],['Vuông','2'],['Tam giác','3'],['L1','4'],['R1','5'],['L2','6'],['R2','7'],['L3','10'],['R3','11'],['Lên','13'],['Xuống','14'],['Trái','15'],['Phải','16']]),field('STATE',[['vừa nhấn','PRESS'],['đang giữ','HELD'],['vừa thả','RELEASE']])], output:'Boolean', colour:'#bd4d86', tooltip:'Vừa nhấn/thả: một lần theo cạnh nút. Đang giữ: đúng liên tục. Đây là bản thử nghiệm hình dạng, chưa thực thi.' },
]);
const rootInit=Blockly.Blocks[TYPES.root].init;
Blockly.Blocks[TYPES.root].init=function() {
  rootInit.call(this);
  this.hat='cap';
  this.setDeletable(false);
  this.isCopyable=()=>false;
  this.isDuplicatable=()=>false;
};

// New design IDs only: old project definitions, fields and generators are untouched.
export const previewMotorTypes = new Map();
for (const {group,title,...definition} of robotBlocks.filter(b=>b.group==='motor')) {
  const type='newmania_design_'+definition.type;
  const spec=structuredClone(definition);
  spec.type=type;
  for (const arg of spec.args0||[]) if(arg.name==='MOTOR') arg.options=Array.from({length:4},(_,i)=>['M'+(i+1),'motor-'+(i+1)]);
  spec.message0=spec.message0.replace('PWM','công suất');
  Blockly.defineBlocksWithJsonArray([spec]);
  previewMotorTypes.set(definition.type,type);
}

export const unsupported = new Map([
  ...['controls_whileUntil','controls_for','controls_flow_statements','math_modulo','math_single','math_random_int','math_round','math_constrain','text_join','text_print','beginner_serial_ready','codelab_serial_print','codelab_serial_available','codelab_serial_read'].map(type=>[type,'Chưa hỗ trợ đầy đủ trong generator Newmania; giữ block cũ, chưa cho kéo thêm.']),
  ...['beginner_led','beginner_blink'].map(type=>[type,'Chưa sử dụng: LED trên board đang dành cho trạng thái hệ thống.']),
]);

export const workspaceOptions = { maxInstances:{ [TYPES.root]:1, [TYPES.forever]:1, [TYPES.connect]:1 } };
export function designToolbox() {
  const toolbox=structuredClone(editorToolbox(FAST4WD_BOARD_ID));
  for (const category of toolbox.contents) {
    const seenMotors=new Set();
    category.contents=(category.contents||[]).flatMap(entry=>{
      if(['beginner_start','robot_ps4_event'].includes(entry.type))return [];
      const copy=structuredClone(entry);
      if(copy.type==='beginner_forever')copy.type=TYPES.forever;
      if(copy.type==='robot_ps4_button') { copy.type=TYPES.button; copy.fields={BUTTON:'0',STATE:'HELD'}; }
      if(previewMotorTypes.has(copy.type)) {
        if(seenMotors.has(copy.type))return [];
        seenMotors.add(copy.type);copy.type=previewMotorTypes.get(copy.type);
      }
      if(unsupported.has(copy.type))copy.disabled=true;
      return [copy];
    });
    if(category.name==='Tay cầm PS4')category.contents.unshift({kind:'block',type:TYPES.connect});
    if(category.contents.some(b=>b.disabled))category.contents.push({kind:'label',text:'Mục mờ: chưa hỗ trợ, không kéo được'});
  }
  return toolbox;
}

export function initializeDesign(workspace) {
  if(workspace.getAllBlocks(false).length)throw new Error('Không tự chuyển workspace hiện có sang thiết kế mới.');
  // The pre-created root must not enter user undo history.
  Blockly.Events.disable();
  try { return workspace.newBlock(TYPES.root); }
  finally { Blockly.Events.enable(); }
}
export function designDiagnostics(workspace) {
  const all=workspace.getAllBlocks(false), roots=all.filter(b=>b.type===TYPES.root);
  const issues=[];
  const add=(block,message)=>issues.push({id:block?.id||'workspace',type:block?.type||'workspace',message});
  if(roots.length!==1)add(null,'Chương trình phải có đúng một khối gốc. Không tự xóa dữ liệu để sửa lỗi này.');
  const root=roots[0];
  const main=[];
  for(let b=root?.getInputTargetBlock('DO');b;b=b.getNextBlock())main.push(b);
  const loops=all.filter(b=>b.type===TYPES.forever), connections=all.filter(b=>b.type===TYPES.connect);
  if(loops.length>1)add(loops[1],'Chỉ dùng một Lặp mãi mãi trong luồng chính.');
  if(connections.length>1)add(connections[1],'Chỉ dùng một Kết nối tay cầm PS4.');
  for(const loop of loops)if(!main.includes(loop)||main.at(-1)!==loop)add(loop,'Đặt Lặp mãi mãi ở cuối luồng chính, trực tiếp trong khối gốc.');
  for(const connect of connections)if(!main.includes(connect))add(connect,'Đặt Kết nối tay cầm PS4 trực tiếp trong khối gốc, trước vòng lặp.');
  const ps4Used=all.some(b=>[TYPES.button,'robot_ps4_axis','fast4wd_connected'].includes(b.type));
  if(ps4Used&&!connections.length)add(root,'Thêm Kết nối tay cầm PS4 trước khi sử dụng tay cầm.');
  for(const b of all) {
    if(b!==root&&!b.getParent()&&!b.isShadow())add(b,'Khối chưa nối vào chương trình; không được thực thi.');
    if(unsupported.has(b.type))add(b,unsupported.get(b.type));
    if(['beginner_start','beginner_forever','robot_ps4_event'].includes(b.type))add(b,'Cấu trúc dự án cũ: giữ nguyên dữ liệu, không tự chuyển đổi trong bản thử nghiệm.');
  }
  return issues;
}

export const DESIGN_FORMAT='codelab-blockly-design';
export function saveDesign(workspace) {
  return {format:DESIGN_FORMAT,version:1,boardId:FAST4WD_BOARD_ID,workspace:Blockly.serialization.workspaces.save(workspace)};
}
export function loadDesign(payload) {
  if(payload?.format!==DESIGN_FORMAT||payload.version!==1||payload.boardId!==FAST4WD_BOARD_ID||!payload.workspace)throw new Error('Chỉ mở tệp thử nghiệm Blockly. Dự án CodeLab cũ không bị chuyển đổi; hãy mở bằng trình chỉnh sửa hiện tại.');
  const w=new Blockly.Workspace(new Blockly.Options(workspaceOptions));
  try { Blockly.serialization.workspaces.load(payload.workspace,w); return w; }
  catch(error) { w.dispose();throw error; }
}

export function exampleDesign(name) {
  const w=new Blockly.Workspace(new Blockly.Options(workspaceOptions));
  const root=initializeDesign(w),connect=w.newBlock(TYPES.connect),loop=w.newBlock(TYPES.forever);
  root.getInput('DO').connection.connect(connect.previousConnection);
  const chain=(a,b)=>a.nextConnection.connect(b.previousConnection);
  const num=n=>{const b=w.newBlock('math_number');b.setFieldValue(n,'NUM');return b;};
  if(name==='count') {
    const variable=w.getVariableMap().createVariable('đếm');
    const set=w.newBlock('variables_set');set.setFieldValue(variable.getId(),'VAR');set.getInput('VALUE').connection.connect(num(0).outputConnection);
    chain(connect,set);chain(set,loop);
    const condition=w.newBlock('controls_if'),button=w.newBlock(TYPES.button);button.setFieldValue('PRESS','STATE');
    loop.getInput('DO').connection.connect(condition.previousConnection);condition.getInput('IF0').connection.connect(button.outputConnection);
    const change=w.newBlock('math_change');change.setFieldValue(variable.getId(),'VAR');change.getInput('DELTA').connection.connect(num(1).outputConnection);condition.getInput('DO0').connection.connect(change.previousConnection);
    const message=w.newBlock('beginner_message'),value=w.newBlock('variables_get');value.setFieldValue(variable.getId(),'VAR');message.getInput('VALUE').connection.connect(value.outputConnection);chain(change,message);
  } else if(name==='drive') {
    chain(connect,loop);const drive=w.newBlock('robot_mecanum');loop.getInput('DO').connection.connect(drive.previousConnection);
    // Approved axes only. This prototype does not change axis signs or runtime mapping.
    for(const [input,index] of [['FORWARD','1'],['LEFT','2'],['TURN','0']]) {const axis=w.newBlock('robot_ps4_axis');axis.setFieldValue(index,'AXIS');drive.getInput(input).connection.connect(axis.outputConnection);}
  } else {
    chain(connect,loop);const condition=w.newBlock('controls_if');condition.loadExtraState({hasElse:true});loop.getInput('DO').connection.connect(condition.previousConnection);
    const button=w.newBlock(TYPES.button);button.setFieldValue('HELD','STATE');condition.getInput('IF0').connection.connect(button.outputConnection);
    const spin=w.newBlock(previewMotorTypes.get('robot_motor_spin'));spin.getInput('POWER').connection.connect(num(20).outputConnection);condition.getInput('DO0').connection.connect(spin.previousConnection);
    const stop=w.newBlock(previewMotorTypes.get('robot_motor_stop'));condition.getInput('ELSE').connection.connect(stop.previousConnection);
  }
  const payload=saveDesign(w);w.dispose();return payload;
}
