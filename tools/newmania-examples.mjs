import * as Blockly from 'blockly';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exampleDesign, loadDesign } from '../src/design-preview/model.js';
import { NEWMANIA_MODEL } from '../src/blocks/newmania.js';
import { FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';
import { generateArduino } from '../src/generators/arduino.js';

export const NEWMANIA_EXAMPLES={hold_m1:['hold','Giữ X chạy Motor M1'],counter_x:['count','Nhấn X tăng biến đếm'],mecanum:['drive','Robot mecanum 4 bánh bằng PS4']};
export function newmaniaExample(name) {
  const [kind,title]=NEWMANIA_EXAMPLES[name],w=loadDesign(exampleDesign(kind));
  let state;
  try {state=Blockly.serialization.workspaces.save(w);}finally{w.dispose();}
  const ids=new Map((state.variables??[]).map((v,i)=>[v.id,`${name}-variable-${i}`]));
  let next=0;
  const normalize=value=>{
    if(!value||typeof value!=='object')return;
    if(value.id) {
      if(!ids.has(value.id))ids.set(value.id,`${name}-block-${next++}`);
      value.id=ids.get(value.id);
    }
    for(const child of Object.values(value))if(child&&typeof child==='object')normalize(child);
  };
  normalize(state);state.blocks.blocks[0].x=40;state.blocks.blocks[0].y=40;
  const devices=defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID));
  const project={name:title,boardId:FAST4WD_BOARD_ID,programModel:NEWMANIA_MODEL,editorMode:'beginner',deviceConfigs:{[FAST4WD_BOARD_ID]:devices},workspace:state};
  return {format:'codelab-project',version:1,project};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))for(const name of Object.keys(NEWMANIA_EXAMPLES)) {
  const payload=newmaniaExample(name),w=new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(payload.project.workspace,w);
    const result=generateArduino(w,FAST4WD_BOARD_ID,payload.project.deviceConfigs[FAST4WD_BOARD_ID]);
    if(result.warnings.length)throw Error(result.warnings.join('\n'));
    const directory=resolve('examples/newmania',name);mkdirSync(directory,{recursive:true});
    writeFileSync(join(directory,name+'.codelab.json'),JSON.stringify(payload,null,2)+'\n');
    writeFileSync(join(directory,name+'.ino'),result.code);
    console.log(name,result.code.length+' bytes source');
  } finally {w.dispose();}
}
