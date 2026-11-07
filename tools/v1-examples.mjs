import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/robotics.js';
import { generateArduino } from '../src/generators/arduino.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { getBoardProfile } from '../src/boards/profiles.js';

const profile = getBoardProfile('newmania-starter-v1');
export function exampleWorkspace(kind) {
  const workspace = new Blockly.Workspace();
  let tail;
  let blockIndex=0;
  const newBlock=type=>workspace.newBlock(type, `${kind}-${blockIndex++}`);
  function number(value) { const b=newBlock('math_number'); b.setFieldValue(value,'NUM'); return b; }
  function expr(type,inputs={}) {
    const b=newBlock(type);
    for (const [name,value] of Object.entries(inputs)) b.getInput(name).connection.connect(number(value).outputConnection);
    return b;
  }
  function statement(type,inputs={},fields={}) {
    const b=expr(type,inputs);
    for(const [name,value] of Object.entries(fields)) b.setFieldValue(value,name);
    if(tail) tail.nextConnection.connect(b.previousConnection);
    tail=b; return b;
  }
  function print(value) { const b=statement('text_print'); b.getInput('TEXT').connection.connect(value.outputConnection); }
  if(kind==='blink') {
    statement('codelab_gpio_write',{PIN:47},{STATE:'HIGH'});
    statement('codelab_delay_ms',{DURATION:500});
    statement('codelab_gpio_write',{PIN:47},{STATE:'LOW'});
    statement('codelab_delay_ms',{DURATION:500});
  } else if(kind==='serial_hello') {
    const text=newBlock('text');text.setFieldValue('Hello, Newmania!','TEXT');print(text);
    statement('codelab_delay_ms',{DURATION:1000});
  } else if(kind==='digital_input' || kind==='adc_read') {
    print(expr(kind==='digital_input'?'codelab_gpio_read':'codelab_analog_read',{PIN:1}));
    statement('codelab_delay_ms',{DURATION:250});
  } else if(kind==='pwm_led') {
    statement('codelab_pwm_write',{PIN:47,DUTY:32});
    statement('codelab_delay_ms',{DURATION:1000});
  } else if(kind!=='minimal') throw new Error('Unknown example: '+kind);
  return workspace;
}
export const EXAMPLES=['minimal','blink','serial_hello','digital_input','adc_read','pwm_led'];
export async function writeExamples() {
  for(const name of EXAMPLES) {
    const workspace=exampleWorkspace(name);
    try {
      const result=generateArduino(workspace,profile.id);
      if(result.warnings.length) throw new Error(result.warnings.join('\n'));
      const dir=`firmware/newmania_v1/examples/${name}`;
      await mkdir(dir,{recursive:true});
      await writeFile(`${dir}/${name}.ino`,result.code);
      await writeFile(`${dir}/${name}.codelab.json`,JSON.stringify({format:'codelab-project',version:1,project:{name,boardId:profile.id,workspace:Blockly.serialization.workspaces.save(workspace)}},null,2)+'\n');
    } finally { workspace.dispose(); }
  }
  await mkdir('firmware/newmania_v1',{recursive:true});
  const w=exampleWorkspace('minimal');
  await writeFile('firmware/newmania_v1/newmania_v1.ino',generateArduino(w,profile.id).code);w.dispose();
}
if(process.argv[1]?.endsWith('v1-examples.mjs')) await writeExamples();
