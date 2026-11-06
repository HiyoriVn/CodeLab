import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import {readFileSync} from 'node:fs';
import {BEGINNER_EXAMPLES,LESSON_BOARD,beginnerWorkspace} from '../tools/beginner-examples.mjs';
import {editorToolbox,projectEditorMode} from '../src/blocks/beginner-toolbox.js';
import {BOARD_PROFILES} from '../src/boards/profiles.js';
import {generateArduino} from '../src/generators/arduino.js';
import '../src/blocks/controller.js';
const types=toolbox=>toolbox.contents.flatMap(c=>c.contents||[]).map(b=>b.type);
test('new lessons have deterministic C++ and lossless version1 serialization',()=>{
  for(const name of BEGINNER_EXAMPLES) {
    const w=beginnerWorkspace(name),a=generateArduino(w,LESSON_BOARD);
    assert.deepEqual(a.warnings,[]);
    assert.equal(a.code,readFileSync(`examples/beginner/${name}/${name}.ino`,'utf8'));
    const fixture=JSON.parse(readFileSync(`examples/beginner/${name}/${name}.codelab.json`,'utf8'));
    assert.equal(projectEditorMode(fixture.project),'beginner');
    const restored=new Blockly.Workspace();Blockly.serialization.workspaces.load(fixture.project.workspace,restored);
    assert.equal(generateArduino(restored,LESSON_BOARD).code,a.code);
    assert.doesNotMatch(a.code,/ledc|Servo|Wire.begin|Serial1.begin|pinMode\(3[567]/);
    if(name==='lesson_ps4_simulation') {assert.match(a.code,/SIMULATION ONLY/);assert.match(a.code,/Serial.println\(lessonLX\)/);assert.match(a.code,/Serial.println\(lessonCross\)/);}
    restored.dispose();w.dispose();
  }
});
test('mode and board switching only change toolbox; unsupported channels/old GPIO stay intact',()=>{
  const w=new Blockly.Workspace();const motor=w.newBlock('beginner_motor');motor.setFieldValue('6','CHANNEL');
  const old=w.newBlock('codelab_gpio_write'),pin=w.newBlock('math_number');pin.setFieldValue(35,'NUM');old.getInput('PIN').connection.connect(pin.outputConnection);
  const before=Blockly.serialization.workspaces.save(w);
  for(const board of BOARD_PROFILES)for(const mode of ['beginner','advanced']) {
    w.codelabBoardId=board.id;editorToolbox(board.id,mode);const out=generateArduino(w,board.id);
    assert.ok(out.warnings.length);assert.equal(motor.getFieldValue('CHANNEL'),'6');
    assert.deepEqual(Blockly.serialization.workspaces.save(w),before);
  }
  assert.equal(projectEditorMode({}),'advanced');assert.equal(projectEditorMode({editorMode:'unknown'}),'advanced');
  w.dispose();
});
test('toolbox is compact, profile-aware and raw hardware appears only in Advanced',()=>{
  for(const board of BOARD_PROFILES) {
    const basic=editorToolbox(board.id,'beginner'),advanced=editorToolbox(board.id,'advanced');
    assert.ok(!types(basic).includes('codelab_gpio_write'));assert.ok(types(advanced).includes('codelab_gpio_write'));
    assert.equal(types(basic).includes('beginner_led'),Number.isInteger(board.pins.led));
    assert.equal(types(basic).includes('beginner_motor'),board.capabilities.motorChannels>0);
    assert.equal(types(basic).includes('beginner_ps4_setup'),!!board.pins.uart1);
    assert.ok(!types(basic).some(t=>t?.includes('begin_i2c')));
    for(const c of basic.contents)for(const entry of c.contents)assert.ok(Blockly.Blocks[entry.type],entry.type);
  }
});
test('startup runs once after pin setup; forever uses Arduino loop without nested infinite loop',()=>{
  const w=new Blockly.Workspace(),start=w.newBlock('beginner_start'),led=w.newBlock('beginner_led'),forever=w.newBlock('beginner_forever'),wait=w.newBlock('beginner_wait');
  start.getInput('DO').connection.connect(led.previousConnection);forever.getInput('DO').connection.connect(wait.previousConnection);
  const out=generateArduino(w,LESSON_BOARD);assert.deepEqual(out.warnings,[]);
  assert.ok(out.code.indexOf('pinMode(47, OUTPUT)')<out.code.indexOf('digitalWrite(47, HIGH)'));
  assert.ok(out.code.indexOf('digitalWrite(47, HIGH)')<out.code.indexOf('void loop()'));
  assert.match(out.code,/void loop\(\) \{\s*delay\(1000\);\s*delay\(1\);/);assert.doesNotMatch(out.code,/while\s*\(true\)/);w.dispose();
});
test('unsupported LEDs/actuators block compilation and emit no actuator calls',()=>{
  for(const board of BOARD_PROFILES)for(const type of ['beginner_motor','beginner_motor_stop','beginner_servo']) {
    const w=new Blockly.Workspace();w.newBlock(type);const out=generateArduino(w,board.id);
    assert.ok(out.warnings.some(s=>s.includes('Chưa thể')));assert.doesNotMatch(out.code,/ledc|Servo.attach|analogWrite/);w.dispose();
  }
  const w=new Blockly.Workspace();w.newBlock('beginner_led');assert.ok(generateArduino(w).warnings.length);w.dispose();
});
test('beginner PS4 real UART reuses CSV adapter; experimental fails closed; mixed sources rejected',()=>{
  const w=new Blockly.Workspace();w.newBlock('beginner_ps4_setup');w.newBlock('beginner_ps4_connected');
  const real=generateArduino(w,'steam-mainboard-v2');assert.deepEqual(real.warnings,[]);assert.match(real.code,/Serial1.begin\(115200, SERIAL_8N1, 7, 6\)/);
  assert.ok(generateArduino(w,LESSON_BOARD).warnings.length);
  w.newBlock('beginner_ps4_sim');assert.ok(generateArduino(w,'steam-mainboard-v2').warnings.some(s=>s.includes('không dùng cả hai')));w.dispose();
});
test('simulation source must be enabled; duplicate sources report useful warnings',()=>{
  const w=new Blockly.Workspace(),start=w.newBlock('beginner_start'),sim=w.newBlock('beginner_ps4_sim');
  start.getInput('DO').connection.connect(sim.previousConnection);
  start.setDisabledReason(true,'test');w.newBlock('beginner_ps4_connected');
  const disabled=generateArduino(w,LESSON_BOARD);assert.ok(disabled.warnings.length);assert.doesNotMatch(disabled.code,/lessonConnected/);
  start.setDisabledReason(false,'test');w.newBlock('beginner_ps4_sim');assert.ok(generateArduino(w,LESSON_BOARD).warnings.some(s=>s.includes('Chỉ dùng một')));
  w.newBlock('codelab_ps4_begin_uart');assert.ok(generateArduino(w,LESSON_BOARD).warnings.some(s=>s.includes('không dùng cả hai')));
  w.dispose();
});
test('beginner value blocks work with existing variables, including helper-name collisions',()=>{
  const w=beginnerWorkspace('lesson_ps4_simulation'),variable=w.getVariableMap().createVariable('lessonLX');
  const set=w.newBlock('variables_set');set.setFieldValue(variable.getId(),'VAR');set.getInput('VALUE').connection.connect(w.newBlock('beginner_ps4_axis').outputConnection);
  const result=generateArduino(w,LESSON_BOARD);assert.deepEqual(result.warnings,[]);
  assert.doesNotMatch(result.code,/double lessonLX =/);w.dispose();
});
