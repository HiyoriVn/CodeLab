import * as Blockly from 'blockly';
import { loops } from 'blockly/blocks';
import './beginner.js';
import './controller.js';
import './robotics.js';
import { robotBlocks } from './robot-devices.js';
import { editorToolbox } from './beginner-toolbox.js';
import { FAST4WD_BOARD_ID } from '../boards/profiles.js';

export const TYPES = Object.freeze({ root: 'newmania_design_program', forever: 'newmania_design_forever', connect: 'newmania_design_ps4_connect', button: 'newmania_design_ps4_button' });
loops.loopTypes.add(TYPES.forever);
const field = (name, options) => ({ type: 'field_dropdown', name, options });
Blockly.defineBlocksWithJsonArray([
  { type:TYPES.root, message0:'Khi bắt đầu chương trình %1 %2', args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}], colour:'#e79b23', tooltip:'Chạy một lần mỗi lượt RUN. Đây là khối gốc duy nhất của chương trình.' },
  { type:TYPES.forever, message0:'Lặp mãi mãi %1 %2', args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}], previousStatement:null, colour:'#e79b23', tooltip:'Đặt cuối luồng chính, bên trong Khi bắt đầu chương trình.' },
  { type:TYPES.connect, message0:'Kết nối tay cầm PS4', previousStatement:null, nextStatement:null, colour:'#bd4d86', tooltip:'Chuẩn bị sử dụng tay cầm; không chờ, không tự ARM hay chạy motor. Ghép đôi Bluetooth với D1 là thao tác riêng.' },
  { type:TYPES.button, message0:'Nút PS4 %1 %2 ?', args0:[field('BUTTON', [['X','0'],['Tròn','1'],['Vuông','2'],['Tam giác','3'],['L1','4'],['R1','5'],['L2','6'],['R2','7'],['L3','10'],['R3','11'],['Lên','13'],['Xuống','14'],['Trái','15'],['Phải','16']]),field('STATE',[['vừa nhấn','PRESS'],['đang giữ','HELD'],['vừa thả','RELEASE']])], output:'Boolean', colour:'#bd4d86', tooltip:'Vừa nhấn/thả: một lần theo cạnh nút. Đang giữ: đúng liên tục. Mỗi khối đọc có trạng thái độc lập; không chạy bù cạnh trong lúc Đợi.' },
]);
const rootInit=Blockly.Blocks[TYPES.root].init;
Blockly.Blocks[TYPES.root].init=function() {
  rootInit.call(this);
  this.hat='cap';
  this.setDeletable(false);
  this.isCopyable=()=>false;
  this.isDuplicatable=()=>false;
};

// Stable IDs introduced by the stage-one preview: old project definitions, fields and generators are untouched.
export const previewMotorTypes = new Map();
for (const {group,title,...definition} of robotBlocks.filter(b=>b.group==='motor')) {
  const type='newmania_design_'+definition.type;
  const spec=structuredClone(definition);
  spec.type=type;
  for (const arg of spec.args0||[]) if(arg.name==='MOTOR') arg.options=Array.from({length:4},(_,i)=>['M'+(i+1),'motor-'+(i+1)]);
  spec.message0=spec.message0.replace('PWM','công suất');
  Blockly.defineBlocksWithJsonArray([spec]);
  if(spec.args0?.some(arg=>arg.name==='MOTOR')) {
    const init=Blockly.Blocks[type].init;
    Blockly.Blocks[type].init=function() {
      init.call(this);
      this.getField('MOTOR').setOptions(()=>Array.from({length:4},(_,i)=>{
        const id='motor-'+(i+1),device=this.workspace.codelabRobotDevices?.motors.find(m=>m.id===id);
        return ['M'+(device?.port??i+1)+(device&&!device.enabled?' (tắt)':''),id];
      }));
    };
  }
  previewMotorTypes.set(definition.type,type);
}

export const unsupported = new Map(
  ['beginner_led','beginner_blink'].map(type=>[type,'GPIO47 đang dành cho kết nối/an toàn; block LED học sinh tiếp tục bị khóa.']),
);

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
    if(category.contents.some(b=>b.disabled))category.contents.push({kind:'label',text:'LED hệ thống: đang dùng cho kết nối/an toàn'});
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
  if(root&&!root.isEnabled())add(root,'Khối gốc đang bị khóa; chưa thể chạy chương trình.');
  const main=[];
  for(let b=root?.getInputTargetBlock('DO');b;b=b.getNextBlock())main.push(b);
  const loops=all.filter(b=>b.type===TYPES.forever), connections=all.filter(b=>b.type===TYPES.connect);
  if(loops.length>1)add(loops[1],'Chỉ dùng một Lặp mãi mãi trong luồng chính.');
  if(connections.length>1)add(connections[1],'Chỉ dùng một Kết nối tay cầm PS4.');
  for(const loop of loops)if(!main.includes(loop)||main.at(-1)!==loop)add(loop,'Đặt Lặp mãi mãi ở cuối luồng chính, trực tiếp trong khối gốc.');
  for(const connect of connections)if(!main.includes(connect))add(connect,'Đặt Kết nối tay cầm PS4 trực tiếp trong khối gốc, trước vòng lặp.');
  const ps4Used=all.some(b=>[TYPES.button,'robot_ps4_axis','fast4wd_connected'].includes(b.type));
  if(ps4Used&&!connections.length)add(root,'Thêm Kết nối tay cầm PS4 trước khi sử dụng tay cầm.');
  if(connections.length===1&&main.includes(connections[0]))for(const b of all.filter(b=>[TYPES.button,'robot_ps4_axis','fast4wd_connected'].includes(b.type))) {
    let outer=b;while(outer.getParent()&&outer.getParent()!==root)outer=outer.getParent();
    if(main.includes(outer)&&main.indexOf(outer)<main.indexOf(connections[0]))add(b,'Đặt Kết nối tay cầm PS4 trước lệnh đọc tay cầm.');
  }
  for(const b of all) {
    if(b!==root&&!b.getParent()&&!b.isShadow())add(b,'Khối chưa nối vào chương trình; không được thực thi.');
    if(unsupported.has(b.type))add(b,unsupported.get(b.type));
    if(['beginner_start','beginner_forever','robot_ps4_event'].includes(b.type))add(b,'Cấu trúc dự án cũ: giữ nguyên dữ liệu, không tự chuyển đổi trong bản thử nghiệm.');
  }
  return issues;
}

export const NEWMANIA_MODEL = 'newmania-v1';
export function hasNewmaniaBlocks(workspace) {
  return workspace.codelabProgramModel === NEWMANIA_MODEL || workspace.getAllBlocks(false).some(b => b.type.startsWith('newmania_design_'));
}
export function usesNewmaniaProgram(project) {
  const visit = value => value && typeof value === 'object' &&
    (value.type === TYPES.root || Object.values(value).some(visit));
  return project?.programModel === NEWMANIA_MODEL || Boolean(visit(project?.workspace));
}
export function newmaniaWorkspace() {
  const workspace = new Blockly.Workspace(new Blockly.Options(workspaceOptions));
  try { const root = initializeDesign(workspace); root.moveBy(40,40); return Blockly.serialization.workspaces.save(workspace); }
  finally { workspace.dispose(); }
}
export function protectNewmaniaRoots(workspace) {
  for(const b of workspace.getBlocksByType(TYPES.root,false)) b.setDeletable(false);
}
