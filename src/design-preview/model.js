import * as Blockly from 'blockly';
import { FAST4WD_BOARD_ID } from '../boards/profiles.js';
import { TYPES, workspaceOptions, initializeDesign, previewMotorTypes } from '../blocks/newmania.js';
export * from '../blocks/newmania.js';

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
