import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/robotics.js';
import { getBoardProfile, BOARD_PROFILES, validatePin, projectBoardId, DEFAULT_BOARD_ID } from '../src/boards/profiles.js';
import { generateArduino } from '../src/generators/arduino.js';
import { startupCode } from '../src/boards/startup.js';
import { exampleWorkspace, EXAMPLES } from '../tools/v1-examples.mjs';
import { readFileSync } from 'node:fs';
const v1=getBoardProfile('newmania-starter-v1'),v2=getBoardProfile('steam-mainboard-v2');
test('V1 complete mapping and memory match supplied kit',()=>{
  assert.deepEqual(v1.pins.motors,[[35,36],[37,38],[39,40],[41,42]]);
  assert.deepEqual(v1.pins.servos,[12,13,14,15]);assert.equal(v1.pins.led,47);assert.equal(v1.pins.buzzer,17);
  assert.deepEqual(v1.pins.uart1,{tx:18,rx:21});assert.deepEqual(v1.pins.i2c,{sda:8,scl:9});
  assert.deepEqual(v1.pins.adc,[1,2,4,5,6,7,10,11]);assert.deepEqual(v1.pins.adcExpansion,[3,16]);
  assert.equal(v1.psramType,'QSPI');assert.equal(v1.psramMB,2);assert.match(v1.build.fqbn,/PSRAM=enabled/);
  const physical=[...v1.pins.motors.flat(),...v1.pins.servos,...v1.adc,47,17,18,21,8,9,0];
  assert.equal(new Set(physical).size,physical.length);
});
test('V2 profile matches accepted native BoardConfig without changing it',()=>{
  const native=readFileSync('firmware/mainboard/BoardConfig.h','utf8');
  const pairs=[...native.matchAll(/\{(\d+),(\d+)\}/g)].slice(0,6).map(m=>m.slice(1).map(Number));
  assert.deepEqual(v2.pins.motors,pairs);assert.deepEqual(v2.pins.servos,[14,15,16,17,18,21]);
  assert.deepEqual(v2.pins.encoders,[[1,2],[4,5]]);assert.deepEqual(v2.pins.uart1,{tx:6,rx:7});
  assert.deepEqual(v2.pins.spi,{sck:12,mosi:11,miso:13,cs:10});assert.equal(v2.psramMB,0);
  assert.match(v2.build.fqbn,/PSRAM=disabled/);
});
test('profiles are immutable, IDs validated, legacy files default generic',()=>{
  assert.equal(BOARD_PROFILES.length,5);assert.equal(projectBoardId({workspace:{}}),DEFAULT_BOARD_ID);
  assert.equal(projectBoardId({boardId:v1.id}),v1.id);assert.throws(()=>projectBoardId({boardId:'unknown'}));
  assert.throws(()=>{v1.pins.servos.push(19);});
});
test('pin validation blocks motor, servo, memory, bus, strap and unsupported ADC',()=>{
  for(const p of [...v1.pins.motors.flat(),...v1.pins.servos,17,18,21,8,9,19,20,0,3,26,27,32,45,46,48]) assert.ok(validatePin(v1,p).length,`${p}`);
  assert.deepEqual(validatePin(v1,47),[]);assert.deepEqual(validatePin(v1,1,true),[]);assert.deepEqual(validatePin(v1,16,true),[]);
  assert.ok(validatePin(v1,47,true).length);assert.ok(validatePin(v1,22).length);assert.ok(validatePin(v1,1.5).length);
});
test('examples generate deterministic safe standalone code and serialize unchanged',()=>{
  for(const kind of EXAMPLES) {
    const w=exampleWorkspace(kind);
    const saved=Blockly.serialization.workspaces.save(w);
    const a=generateArduino(w,v1.id),b=generateArduino(w,v1.id);
    assert.deepEqual(a.warnings,[]);assert.equal(a.code,b.code);
    assert.ok(a.code.indexOf('if (!codelabSafeStartup())')<a.code.indexOf('Serial.begin'));
    assert.match(a.code,/servos\[\] = \{12, 13, 14, 15\}/);
    const restored=new Blockly.Workspace();Blockly.serialization.workspaces.load(saved,restored);
    assert.equal(generateArduino(restored,v1.id).code,a.code);
    assert.deepEqual(saved,Blockly.serialization.workspaces.save(w));restored.dispose();w.dispose();
  }
});
test('generic no-argument generation retains empty sketch output and no board startup',()=>{
  const w=new Blockly.Workspace();const out=generateArduino(w);
  assert.deepEqual(out.warnings,[]);assert.equal(out.code,'#include <Arduino.h>\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n\n}\n');
  assert.equal(generateArduino(w,DEFAULT_BOARD_ID).code,out.code);w.dispose();
});
test('GPIO conflicts include ADC versus output and PWM versus digital',()=>{
  for(const type of ['codelab_gpio_write','codelab_pwm_write']) {
    const w=exampleWorkspace('adc_read');const b=w.newBlock(type);
    for(const [name,value] of Object.entries(type==='codelab_pwm_write'?{PIN:1,DUTY:20}:{PIN:1})){
      const n=w.newBlock('math_number');n.setFieldValue(value,'NUM');b.getInput(name).connection.connect(n.outputConnection);
    }
    assert.ok(generateArduino(w,v1.id).warnings.some(msg=>/vừa làm/.test(msg)));w.dispose();
  }
});
test('shared startup only touches servo and motor/buzzer low outputs',()=>{
  const code=startupCode(v1).definitions;
  assert.match(code,/lowOutputs\[\] = \{35, 36, 37, 38, 39, 40, 41, 42, 17\}/);
  assert.ok(code.indexOf('gpio_set_level')<code.indexOf('GPIO_MODE_OUTPUT'));
  assert.doesNotMatch(code,/ledc|Serial|Wire|POWER_GOOD/);
});

test('concrete profiles block generic H-bridge even on free digital pins',()=>{
  const w=new Blockly.Workspace();const b=w.newBlock('codelab_hbridge_motor');
  for(const [name,value] of Object.entries({IN1:1,IN2:2,PWM:4,SPEED:0})){const n=w.newBlock('math_number');n.setFieldValue(value,'NUM');b.getInput(name).connection.connect(n.outputConnection);}
  assert.ok(generateArduino(w,v1.id).warnings.some(msg=>msg.includes('chưa cho phép điều khiển motor')));w.dispose();
});
test('standalone V1 firmware and committed examples match generated source',()=>{
  for(const kind of EXAMPLES){const w=exampleWorkspace(kind);const code=generateArduino(w,v1.id).code;assert.equal(readFileSync(`firmware/newmania_v1/examples/${kind}/${kind}.ino`,'utf8'),code);w.dispose();}
  assert.equal(readFileSync('firmware/newmania_v1/newmania_v1.ino','utf8'),readFileSync('firmware/newmania_v1/examples/minimal/minimal.ino','utf8'));
});
