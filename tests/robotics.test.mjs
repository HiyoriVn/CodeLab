import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import {readFileSync} from 'node:fs';
import { CASES,roboticsWorkspace } from '../tools/robotics-examples.mjs';
import { generateArduino } from '../src/generators/arduino.js';
import { roboticsToolbox } from '../src/blocks/robotics-toolbox.js';
test('robotics examples deterministic, schema round-trip and supported build source',()=>{
 for(const c of CASES){const w=roboticsWorkspace(c);const a=generateArduino(w,c.boardId);assert.equal(a.warnings.length===0,c.supported);
 assert.equal(a.code,generateArduino(w,c.boardId).code);
 const saved=Blockly.serialization.workspaces.save(w),r=new Blockly.Workspace();Blockly.serialization.workspaces.load(saved,r);
 assert.equal(generateArduino(r,c.boardId).code,a.code);
 if(c.supported)assert.equal(readFileSync(`firmware/verification/robotics_examples/${c.name}/${c.name}.ino`,'utf8'),a.code);
 r.dispose();w.dispose();}
});
test('motor/servo requests blocked across concrete/generic and out-of-range channels stay intact',()=>{
 for(const profile of ['newmania-starter-v1','steam-mainboard-v2','generic-esp32-s3']){
  for(const type of ['codelab_motor_channel','codelab_servo_write']){
   const w=new Blockly.Workspace(),b=w.newBlock(type);b.setFieldValue('6','CHANNEL');const n=w.newBlock('math_number');n.setFieldValue(100,'NUM');b.getInput(type==='codelab_motor_channel'?'SPEED':'ANGLE').connection.connect(n.outputConnection);
   const before=Blockly.serialization.workspaces.save(w);const out=generateArduino(w,profile);
   assert.ok(out.warnings.some(msg=>msg.includes('chưa được hỗ trợ')));assert.doesNotMatch(out.code,/ledcAttach|ledcWrite|Servo\.attach|codelabMotorWrite/);
   assert.equal(b.getFieldValue('CHANNEL'),'6');assert.deepEqual(Blockly.serialization.workspaces.save(w),before);w.dispose();
  }
 }
});
test('servo disable resolves profile channel, no enable pulses and one helper/include',()=>{
 const c=CASES[1],w=roboticsWorkspace(c);const a=generateArduino(w,c.boardId);assert.deepEqual(a.warnings,[]);
 for(const pin of [14,15,16,17,18,21])assert.ok(a.code.includes(`codelabServoDisable(${pin});`));
 assert.equal((a.code.match(/static void codelabServoDisable/g)||[]).length,1);
 assert.equal((a.code.match(/#include <driver\/gpio.h>/g)||[]).length,1);assert.doesNotMatch(a.code,/ledcAttach|ledcWrite/);
 const v1=generateArduino(w,'newmania-starter-v1');assert.ok(v1.warnings.length);w.dispose();
});
test('toolbox capability filtering does not remove legacy registration',()=>{
 const types=id=>roboticsToolbox(id).map(x=>x.type);
 assert.ok(types('generic-esp32-s3').includes('codelab_hbridge_motor'));
 assert.ok(!types('steam-mainboard-v2').includes('codelab_analog_read'));
 assert.ok(!types('steam-mainboard-v2').includes('codelab_pwm_write'));
 assert.ok(types('newmania-starter-v1').includes('codelab_motor_channel'));
 assert.ok(Blockly.Blocks.codelab_hbridge_motor);assert.ok(Blockly.Blocks.codelab_gpio_read);
});
test('input pull mode, ADC/output and PWM conflicts diagnosed',()=>{
 const w=roboticsWorkspace(CASES[0]);const b=w.newBlock('codelab_gpio_read');const n=w.newBlock('math_number');n.setFieldValue(1,'NUM');b.getInput('PIN').connection.connect(n.outputConnection);
 assert.ok(generateArduino(w,CASES[0].boardId).warnings.some(msg=>msg.includes('vừa làm')));w.dispose();
});

test('statement chains and nested statements preserve execution order',()=>{
 const w=new Blockly.Workspace();
 function print(text){const b=w.newBlock('text_print'),t=w.newBlock('text');t.setFieldValue(text,'TEXT');b.getInput('TEXT').connection.connect(t.outputConnection);return b;}
 const repeat=w.newBlock('controls_repeat_ext'),count=w.newBlock('math_number');count.setFieldValue(2,'NUM');repeat.getInput('TIMES').connection.connect(count.outputConnection);
 const a=print('inside-a'),b=print('inside-b'),c=print('after-loop');
 repeat.getInput('DO').connection.connect(a.previousConnection);a.nextConnection.connect(b.previousConnection);repeat.nextConnection.connect(c.previousConnection);
 const out=generateArduino(w);assert.deepEqual(out.warnings,[]);
 assert.ok(out.code.indexOf('inside-a')<out.code.indexOf('inside-b'));assert.ok(out.code.indexOf('inside-b')<out.code.indexOf('after-loop'));
 assert.match(out.code,/Serial.println\("inside-b"\);\n\s*}\s*}\s*\nSerial.println\("after-loop"\)/);w.dispose();
});
test('V1 full I/O example emits all connected blocks and pull configuration',()=>{
 const w=roboticsWorkspace(CASES[0]);const out=generateArduino(w,CASES[0].boardId);
 for(const code of ['pinMode(1, INPUT_PULLUP);','analogRead(2)','ledcWrite(47','Serial.available()','Serial.read()','delay('])assert.ok(out.code.includes(code),code);w.dispose();
});

test('floating expression blocks have C++ statement terminators',()=>{
 const w=new Blockly.Workspace();w.newBlock('codelab_serial_available');const out=generateArduino(w);assert.deepEqual(out.warnings,[]);assert.match(out.code,/\nSerial.available\(\);\n/);w.dispose();
});
