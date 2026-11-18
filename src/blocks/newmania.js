import * as Blockly from 'blockly';
import { loops } from 'blockly/blocks';
import './beginner.js';
import './controller.js';
import './robotics.js';
import { robotBlocks } from './robot-devices.js';
import { editorToolbox } from './beginner-toolbox.js';
import { FAST4WD_BOARD_ID, V2_BOARD_ID } from '../boards/profiles.js';
import { lockCapHat } from './start-hat.js';

export const TYPES = Object.freeze({ root: 'newmania_design_program', forever: 'newmania_design_forever', connect: 'newmania_design_ps4_connect', ps2Connect: 'newmania_design_ps2_connect', button: 'newmania_design_ps4_button', ps2Button: 'newmania_design_ps2_button', ps2Axis: 'newmania_design_ps2_axis', ps2Connected: 'newmania_design_ps2_connected' });
loops.loopTypes.add(TYPES.forever);
const field = (name, options) => ({ type: 'field_dropdown', name, options });
Blockly.defineBlocksWithJsonArray([
  { type:TYPES.root, message0:'Khi bắt đầu chương trình %1 %2', args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}], colour:'#e79b23', tooltip:'Chạy một lần sau khi board khởi động. Đây là khối gốc duy nhất của chương trình.' },
  { type:TYPES.forever, message0:'Lặp mãi mãi %1 %2', args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}], previousStatement:null, colour:'#e79b23', tooltip:'Đặt cuối luồng chính, bên trong Khi bắt đầu chương trình.' },
  { type:TYPES.connect, message0:'Kết nối tay cầm PS4 qua %1', args0:[field('TRANSPORT', [['PS4 UART', 'UART'], ['PS4 I²C', 'I2C'], ['PS2 SPI', 'PS2']])], previousStatement:null, nextStatement:null, colour:'#bd4d86', tooltip:'Chọn PS4 UART hoặc PS4 I²C. Đặt trước Lặp mãi mãi. Không tự khởi động motor; khi mất tín hiệu phải dừng.' },
  { type:TYPES.ps2Connect, message0:'Kết nối tay cầm PS2 qua SPI', previousStatement:null, nextStatement:null, colour:'#bd4d86', tooltip:'Trên V2 dùng PS2 SPI (CLK12/CMD11/DAT13/ATT10). Ví dụ: Kết nối tay cầm PS2 qua SPI → Lặp mãi mãi → kiểm tra nút X. Đặt trước Lặp mãi mãi. Không tự khởi động motor; khi mất tín hiệu phải dừng.' },
  { type:TYPES.button, message0:'Nút PS4 %1 %2 ?', args0:[field('BUTTON', [['X','0'],['Tròn','1'],['Vuông','2'],['Tam giác','3'],['L1','4'],['R1','5'],['L2','6'],['R2','7'],['L3','10'],['R3','11'],['Lên','13'],['Xuống','14'],['Trái','15'],['Phải','16']]),field('STATE',[['Vừa nhấn','PRESS'],['Đang giữ','HELD'],['Vừa thả','RELEASE']])], output:'Boolean', colour:'#bd4d86', tooltip:'Ví dụ: Nút X Vừa nhấn? để tăng điểm một lần; Đang giữ? để chạy motor khi còn giữ; Vừa thả? để dừng khi buông nút. Các khối đọc độc lập.' },
  { type:TYPES.ps2Button, message0:'Nút PS2 %1 %2 ?', args0:[field('BUTTON', [['X','0'],['Tròn','1'],['Vuông','2'],['Tam giác','3'],['L1','4'],['R1','5'],['L2','6'],['R2','7'],['SELECT','8'],['START','9'],['L3','10'],['R3','11'],['Lên','13'],['Xuống','14'],['Trái','15'],['Phải','16']]),field('STATE',[['Vừa nhấn','PRESS'],['Đang giữ','HELD'],['Vừa thả','RELEASE']])], output:'Boolean', colour:'#8661b8', tooltip:'Đọc nút riêng của tay cầm PS2. START và SELECT có ánh xạ nút tương ứng trong driver. Giữ, nhấn và thả độc lập.' },
  { type:TYPES.ps2Connected, message0:'Tay cầm PS2 đã kết nối?', output:'Boolean', colour:'#8661b8', tooltip:'Đúng khi dữ liệu PS2 SPI còn mới. Mất tín hiệu trả sai và motor được dừng an toàn.' },
]);
const ps2AxisSource = robotBlocks.find(item => item.type === 'robot_ps4_axis');
if (!ps2AxisSource) throw new Error('Missing axis schema');
const {group: axisGroup, title: axisTitle, ...ps2AxisBlock} = structuredClone(ps2AxisSource);
Blockly.defineBlocksWithJsonArray([{...ps2AxisBlock, type:TYPES.ps2Axis, message0:'Độ nghiêng cần PS2 %1 theo %2', colour:'#8661b8', tooltip:'Đọc joystick PS2 (Trái/Phải, Ngang/Dọc), giá trị −100 đến 100; trả về 0 nếu mất kết nối.'}]);
const rootInit=Blockly.Blocks[TYPES.root].init;
Blockly.Blocks[TYPES.root].init=function() {
  rootInit.call(this);
  lockCapHat(this);
  this.setDeletable(false);
  this.isCopyable=()=>false;
  this.isDuplicatable=()=>false;
};
const connectInit = Blockly.Blocks[TYPES.connect].init;
Blockly.Blocks[TYPES.connect].init = function() {
  connectInit.call(this);
  const f = this.getField('TRANSPORT');
  if (f) {
    f.setOptions(() => this.workspace?.codelabBoardId === V2_BOARD_ID && f.getValue() === 'PS2'
      ? [['PS4 UART','UART'],['PS4 I²C','I2C'],['PS2 SPI','PS2']]
      : [['PS4 UART','UART'],['PS4 I²C','I2C']]);
    f.isSerializable = () => f.getValue() !== 'UART';
  }
};

// Stable IDs introduced by the stage-one preview: old project definitions, fields and generators are untouched.
export const previewMotorTypes = new Map();
for (const {group,title,...definition} of robotBlocks.filter(b=>b.group==='motor')) {
  const type='newmania_design_'+definition.type;
  const spec=structuredClone(definition);
  spec.type=type;
  for (const arg of spec.args0||[]) if(arg.name==='MOTOR') arg.options=Array.from({length:6},(_,i)=>['M'+(i+1),'motor-'+(i+1)]);
  spec.message0=spec.message0.replace('PWM','công suất');
  Blockly.defineBlocksWithJsonArray([spec]);
  if(spec.args0?.some(arg=>arg.name==='MOTOR')) {
    const init=Blockly.Blocks[type].init;
    Blockly.Blocks[type].init=function() {
      init.call(this);
      this.getField('MOTOR').setOptions(()=>{
        const count=this.workspace?.codelabRobotDevices?.motors.length||(this.workspace?.codelabBoardId===V2_BOARD_ID?6:4);
        return Array.from({length:count},(_,i)=>{
          const id='motor-'+(i+1),device=this.workspace?.codelabRobotDevices?.motors.find(m=>m.id===id);
          return ['M'+(device?.port??i+1)+(device&&!device.enabled?' (tắt)':''),id];
        });
      });
    };
  }
  previewMotorTypes.set(definition.type,type);
}

export const unsupported = new Map(
  ['beginner_led','beginner_blink'].map(type=>[type,'GPIO47 đang dành cho kết nối/an toàn; block LED học sinh tiếp tục bị khóa.']),
);

export const workspaceOptions = { maxInstances:{ [TYPES.root]:1, [TYPES.forever]:1, [TYPES.connect]:1, [TYPES.ps2Connect]:1 } };
export function designToolbox(boardId = FAST4WD_BOARD_ID) {
  const toolbox=structuredClone(editorToolbox(boardId, 'beginner', undefined, { newmania: true }));
  const nextContents=[];
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
    if(category.name==='Tay cầm PS4') {
      category.contents.unshift({kind:'block',type:TYPES.connect});
      nextContents.push(category);
      if(boardId===V2_BOARD_ID) {
        nextContents.push({
          kind:'category',
          name:'Tay cầm PS2',
          colour:'#8661b8',
          contents:[{kind:'block',type:TYPES.ps2Connect},{kind:'block',type:TYPES.ps2Axis},{kind:'block',type:TYPES.ps2Button,fields:{BUTTON:'0',STATE:'HELD'}},{kind:'block',type:TYPES.ps2Connected}],
        });
      }
      continue;
    }
    if(category.contents.some(b=>b.disabled))category.contents.push({kind:'label',text:'LED hệ thống: đang dùng cho kết nối/an toàn'});
    nextContents.push(category);
  }
  toolbox.contents=nextContents;
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
  const loops=all.filter(b=>b.type===TYPES.forever), connections=all.filter(b=>b.type===TYPES.connect||b.type===TYPES.ps2Connect);
  if(loops.length>1)add(loops[1],'Chỉ dùng một Lặp mãi mãi trong luồng chính.');
  if(connections.length>1)add(connections[1],'Chỉ dùng một Kết nối tay cầm.');
  for(const loop of loops)if(!main.includes(loop)||main.at(-1)!==loop)add(loop,'Đặt Lặp mãi mãi ở cuối luồng chính, trực tiếp trong khối gốc.');
  for(const connect of connections)if(!main.includes(connect))add(connect,'Đặt Kết nối tay cầm trực tiếp trong khối gốc, trước vòng lặp.');
  // PS4/PS2 have independent block IDs and may not be mixed in a new program.
  // Saved early PS2 projects using the old PS4 read block IDs remain loadable.
  const ps4Readers=all.filter(b=>[TYPES.button,'robot_ps4_axis','fast4wd_connected'].includes(b.type));
  const ps2Readers=all.filter(b=>[TYPES.ps2Button,TYPES.ps2Axis,TYPES.ps2Connected].includes(b.type));
  const ps4Connect=connections.find(b=>b.type===TYPES.connect);
  const ps2Connect=connections.find(b=>b.type===TYPES.ps2Connect);
  if(ps4Readers.length&&!ps4Connect&&!ps2Readers.length&&!ps2Connect)add(root,'Thêm Kết nối tay cầm PS4 trước khi đọc PS4.');
  if(ps2Readers.length&&!ps2Connect)add(ps2Readers[0],'Khối đọc PS2 yêu cầu Kết nối tay cầm PS2.');
  if(ps4Readers.length&&ps2Connect)add(ps4Readers[0],'Không dùng block PS4 cùng chương trình PS2; hãy chọn block PS2 tương ứng.');
  if(ps2Readers.length&&ps4Readers.length)add(ps2Readers[0],'Không trộn khối đọc PS4 và PS2 trong cùng chương trình.');
  if(connections.length===1&&main.includes(connections[0]))for(const b of [...ps4Readers,...ps2Readers]) {
    let outer=b;while(outer.getParent()&&outer.getParent()!==root)outer=outer.getParent();
    if(main.includes(outer)&&main.indexOf(outer)<main.indexOf(connections[0]))add(b,'Đặt Kết nối tay cầm trước lệnh đọc tay cầm.');
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
