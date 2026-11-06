import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/beginner.js';
import '../src/blocks/robotics.js';
import {generateArduino} from '../src/generators/arduino.js';
import {mkdir,writeFile} from 'node:fs/promises';
export const BEGINNER_EXAMPLES = ['lesson_blink','lesson_message','lesson_ps4_simulation'];
export const LESSON_BOARD = 'newmania-v1-16m-opi-experimental';
export function beginnerWorkspace(name) {
  const w = new Blockly.Workspace(); w.codelabBoardId = LESSON_BOARD;
  let id=0;
  const block=type=>w.newBlock(type,name+'-'+id++);
  const root=block('beginner_forever');
  root.moveBy(45,35);
  const append=(parent,child)=>parent.getInput('DO').connection.connect(child.previousConnection);
  const text=value=>{const b=block('text');b.setFieldValue(value,'TEXT');return b;};
  const message=value=>{const b=block('beginner_message');b.getInput('VALUE').connection.connect(value.outputConnection);return b;};
  if(name==='lesson_blink') append(root,block('beginner_blink'));
  else if(name==='lesson_message') {
    const start=block('beginner_start');start.moveBy(45,210);append(start,message(text('Hello, CodeLab!')));
    const m=message(block('beginner_serial_ready'));append(root,m);
    const wait=block('beginner_wait');m.nextConnection.connect(wait.previousConnection);
  } else if(name==='lesson_ps4_simulation') {
    const sim=block('beginner_ps4_sim');sim.setFieldValue('TRUE','PRESSED');sim.setFieldValue(500,'LX');append(root,sim);
    const condition=block('controls_if');condition.getInput('IF0').connection.connect(block('beginner_ps4_connected').outputConnection);
    sim.nextConnection.connect(condition.previousConnection);
    const status=message(text('MO PHONG PS4: connected, LX, X:'));
    condition.getInput('DO0').connection.connect(status.previousConnection);
    const axis=message(block('beginner_ps4_axis')),button=message(block('beginner_ps4_button'));
    status.nextConnection.connect(axis.previousConnection);axis.nextConnection.connect(button.previousConnection);
    const wait=block('beginner_wait');condition.nextConnection.connect(wait.previousConnection);
  } else throw new Error('Unknown lesson '+name);
  return w;
}
export async function writeBeginnerExamples() {
  for(const name of BEGINNER_EXAMPLES) {
    const w=beginnerWorkspace(name);
    try {
      const result=generateArduino(w,LESSON_BOARD);
      if(result.warnings.length) throw new Error(result.warnings.join('\n'));
      const dir='examples/beginner/'+name;await mkdir(dir,{recursive:true});
      await writeFile(`${dir}/${name}.ino`,result.code);
      await writeFile(`${dir}/${name}.codelab.json`,JSON.stringify({format:'codelab-project',version:1,project:{name,boardId:LESSON_BOARD,editorMode:'beginner',workspace:Blockly.serialization.workspaces.save(w)}},null,2)+'\n');
    } finally {w.dispose();}
  }
}
if(process.argv[1]?.endsWith('beginner-examples.mjs')) await writeBeginnerExamples();
