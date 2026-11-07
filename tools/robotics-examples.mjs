import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/robotics.js';
import { generateArduino } from '../src/generators/arduino.js';
import { mkdir,writeFile } from 'node:fs/promises';
export const CASES=[
 {name:'v1_io_serial',boardId:'newmania-starter-v1',supported:true},
 {name:'v2_serial_servo_disabled',boardId:'steam-mainboard-v2',supported:true},
 {name:'generic_serial',boardId:'generic-esp32-s3',supported:true},
 {name:'v1_motor_request_unsupported',boardId:'newmania-starter-v1',supported:false},
 {name:'v1_servo_request_unsupported',boardId:'newmania-starter-v1',supported:false},
 {name:'v2_motor_request_unsupported',boardId:'steam-mainboard-v2',supported:false},
];
export function roboticsWorkspace(item) {
 const w=new Blockly.Workspace();w.codelabBoardId=item.boardId;let tail,id=0;
 const block=type=>w.newBlock(type,item.name+'-'+id++);
 const number=value=>{const b=block('math_number');b.setFieldValue(value,'NUM');return b;};
 function make(type,inputs={},fields={}) {
  const b=block(type);for(const [k,v]of Object.entries(inputs))b.getInput(k).connection.connect(number(v).outputConnection);
  for(const [k,v]of Object.entries(fields))b.setFieldValue(v,k);return b;
 }
 function append(b){if(tail)tail.nextConnection.connect(b.previousConnection);tail=b;return b;}
 function print(value){const b=block('codelab_serial_print');b.getInput('VALUE').connection.connect(value.outputConnection);append(b);}
 if(!item.supported){append(make(item.name.includes('servo')?'codelab_servo_write':'codelab_motor_channel',item.name.includes('servo')?{ANGLE:90}:{SPEED:50},{CHANNEL:'1'}));return w;}
 if(item.name==='v1_io_serial'){
  append(make('codelab_gpio_write',{PIN:4},{STATE:'LOW'}));
  print(make('codelab_gpio_read_mode',{PIN:1},{MODE:'INPUT_PULLUP'}));
  print(make('codelab_analog_read',{PIN:2}));
  append(make('codelab_pwm_write',{PIN:47,DUTY:32}));
 }
 if(item.name==='v2_serial_servo_disabled')for(let i=1;i<=6;i++)append(make('codelab_servo_disable',{}, {CHANNEL:String(i)}));
 print(block('codelab_serial_available'));print(block('codelab_serial_read'));
 if(item.name==='generic_serial')block('codelab_serial_available');
 const text=block('text');text.setFieldValue('Robotics "software" test\n','TEXT');print(text);
 append(make('codelab_delay_ms',{DURATION:250}));return w;
}
export async function writeRoboticsExamples(){
 for(const item of CASES){const w=roboticsWorkspace(item);try{
  const result=generateArduino(w,item.boardId);
  if(item.supported && result.warnings.length)throw new Error(result.warnings.join('\n'));
  if(!item.supported && !result.warnings.length)throw new Error('Unsafe example not blocked');
  const dir='firmware/verification/robotics_examples/'+item.name;await mkdir(dir,{recursive:true});
  await writeFile(dir+'/'+item.name+'.codelab.json',JSON.stringify({format:'codelab-project',version:1,project:{name:item.name,boardId:item.boardId,workspace:Blockly.serialization.workspaces.save(w)}},null,2)+'\n');
  if(item.supported)await writeFile(dir+'/'+item.name+'.ino',result.code);
 }finally{w.dispose();}}
}
if(process.argv[1]?.endsWith('robotics-examples.mjs'))await writeRoboticsExamples();
