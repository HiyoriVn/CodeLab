import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { readFileSync } from 'node:fs';
import { getBoardProfile, validatePin } from '../src/boards/profiles.js';
import { startupCode } from '../src/boards/startup.js';
import { generateArduino } from '../src/generators/arduino.js';
import { roboticsToolbox } from '../src/blocks/robotics-toolbox.js';
import { exampleWorkspace } from '../tools/v1-examples.mjs';
import { OPI_BOARD_ID } from '../tools/v1-opi-examples.mjs';

test('experimental OPI variant reserves all except LED47 and never runs motor startup', () => {
  const p = getBoardProfile(OPI_BOARD_ID);
  assert.equal(p.flashMB, 16); assert.equal(p.psramMB, 8);
  assert.match(p.build.fqbn, /FlashSize=16M,PartitionScheme=default_8MB,PSRAM=opi/);
  for (let pin=0; pin<=48; pin++) assert.equal(validatePin(p,pin).length===0, pin===47);
  assert.deepEqual(startupCode(p), {includes:[], definitions:'', setup:[]});
  const types = roboticsToolbox(p.id).map(b=>b.type);
  for (const type of ['codelab_motor_channel','codelab_servo_write','codelab_servo_disable','codelab_hbridge_motor','codelab_analog_read']) assert.ok(!types.includes(type));
  assert.ok(types.includes('codelab_pwm_write'));
});

test('OPI examples serialize deterministically, only explicit Blink configures LED GPIO', () => {
  for (const name of ['minimal','blink','serial_hello']) {
    const w = exampleWorkspace(name), out = generateArduino(w,OPI_BOARD_ID);
    assert.deepEqual(out.warnings,[]);
    assert.equal(out.code,readFileSync(`firmware/verification/v1_opi_examples/${name}/${name}.ino`,'utf8'));
    assert.doesNotMatch(out.code,/gpio_set_|codelabSafeStartup|ledc|Servo/);
    if(name==='blink') { assert.match(out.code,/pinMode\(47, OUTPUT\)/); assert.match(out.code,/digitalWrite\(47, LOW\)/); }
    else assert.doesNotMatch(out.code,/pinMode|digitalWrite/);
    const data=Blockly.serialization.workspaces.save(w), r=new Blockly.Workspace();
    Blockly.serialization.workspaces.load(data,r);
    assert.equal(generateArduino(r,OPI_BOARD_ID).code,out.code);
    r.dispose(); w.dispose();
  }
});

test('switch to OPI preserves invalid old GPIO/channel data but blocks generation', () => {
  for (const type of ['codelab_gpio_write','codelab_motor_channel','codelab_servo_disable']) {
    const w = new Blockly.Workspace(), b=w.newBlock(type);
    if(type==='codelab_gpio_write') { const n=w.newBlock('math_number'); n.setFieldValue(35,'NUM'); b.getInput('PIN').connection.connect(n.outputConnection); }
    const saved=Blockly.serialization.workspaces.save(w);
    const out=generateArduino(w,OPI_BOARD_ID);
    assert.ok(out.warnings.length);
    assert.deepEqual(Blockly.serialization.workspaces.save(w),saved);
    assert.doesNotMatch(out.code,/gpio_set_|codelabSafeStartup|ledcAttach/);
    w.dispose();
  }
});

test('experimental PWM example only attaches LED47 and preserves generated golden', () => {
  const w=exampleWorkspace('pwm_led');
  const out=generateArduino(w,OPI_BOARD_ID);
  assert.deepEqual(out.warnings,[]);
  assert.match(out.code,/ledcAttach\(47, 5000, 8\)/);
  assert.match(out.code,/ledcWrite\(47,/);
  assert.doesNotMatch(out.code,/gpio_set_|codelabSafeStartup/);
  assert.equal(out.code,readFileSync('firmware/verification/v1_opi_examples/pwm_led/pwm_led.ino','utf8'));
  w.dispose();
});
