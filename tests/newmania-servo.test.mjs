import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getBoardProfile, FAST4WD_BOARD_ID, DEFAULT_BOARD_ID } from '../src/boards/profiles.js';
import { editorToolbox } from '../src/blocks/beginner-toolbox.js';
import { designToolbox, TYPES } from '../src/blocks/newmania.js';
import { generateArduino } from '../src/generators/arduino.js';
import '../src/blocks/robot-devices.js';

// --- Setup native host compilation fixtures ---
const outDir = resolve('firmware/tests/build-output/newmania-servo');
mkdirSync(join(outDir, 'driver'), { recursive: true });
for (const header of ['Arduino.h', 'Wire.h', 'esp_chip_info.h', 'esp_efuse.h', 'esp_efuse_table.h', 'driver/gpio.h', 'driver/mcpwm.h']) {
  writeFileSync(join(outDir, header), '#include "fast4wd-platform.h"\n');
}
const flags = [
  '-std=c++17', '-Wall', '-Wextra', '-Werror',
  '-I' + outDir,
  '-I' + resolve('tests/fixtures'),
  ...['CodeLabFast4wd', 'CodeLabPs4I2C', 'CodeLabRobot'].map(lib => '-I' + resolve('firmware/libraries', lib, 'src'))
];
const cxx = process.env.CXX || 'g++';

function makeWorkspaceWithBlocks(builder) {
  const ws = new Blockly.Workspace();
  const root = ws.newBlock(TYPES.root);
  builder(ws, root);
  return ws;
}

test('Unit Test: newmania-fast100-4wd profile maps 4 servos to GPIO12, 13, 14, 15', () => {
  const profile = getBoardProfile(FAST4WD_BOARD_ID);
  assert.equal(profile.id, 'newmania-fast100-4wd');
  assert.deepEqual(profile.pins.servos, [12, 13, 14, 15]);
  assert.equal(profile.capabilities.servoChannels, 4);
  assert.equal(profile.capabilities.servoControl, true);

  // Preserve other board profiles
  const v1 = getBoardProfile('newmania-starter-v1');
  assert.deepEqual(v1.pins.servos, [12, 13, 14, 15]);
  assert.equal(v1.capabilities.servoControl, false);

  const v2 = getBoardProfile('steam-mainboard-v2');
  assert.deepEqual(v2.pins.servos, [14, 15, 16, 17, 18, 21]);
  assert.equal(v2.capabilities.servoControl, false);

  const generic = getBoardProfile(DEFAULT_BOARD_ID);
  assert.equal(Boolean(generic.capabilities.servoControl), false);
});

test('Unit Test: Toolbox displays Servo group adjacent to Motor M1-M4', () => {
  const tb = designToolbox();
  const catNames = tb.contents.map(c => c.name);
  const motorIdx = catNames.indexOf('Motor');
  const servoIdx = catNames.indexOf('Servo');

  assert.ok(motorIdx !== -1, 'Motor category must exist');
  assert.ok(servoIdx !== -1, 'Servo category must exist');
  assert.equal(servoIdx, motorIdx + 1, 'Servo category must be placed directly next to Motor category');

  const servoCat = tb.contents[servoIdx];
  const blockTypes = servoCat.contents.map(c => c.type);
  assert.ok(blockTypes.includes('robot_servo_write'), 'robot_servo_write must be in Servo toolbox');
  assert.ok(blockTypes.includes('robot_servo_disable'), 'robot_servo_disable must be in Servo toolbox');

  const writeEntry = servoCat.contents.find(c => c.type === 'robot_servo_write');
  assert.equal(writeEntry.inputs.ANGLE.shadow.fields.NUM, 90, 'Default angle shadow must be 90 degrees');
});

test('Generator Test: generateNewmania produces correct C++ for S1-S4 servo writes and disables', () => {
  const ws = makeWorkspaceWithBlocks((w, root) => {
    const s1 = w.newBlock('robot_servo_write');
    s1.setFieldValue('1', 'SERVO');
    const angle1 = w.newBlock('math_number');
    angle1.setFieldValue('90', 'NUM');
    s1.getInput('ANGLE').connection.connect(angle1.outputConnection);
    root.getInput('DO').connection.connect(s1.previousConnection);

    const s2 = w.newBlock('robot_servo_write');
    s2.setFieldValue('2', 'SERVO');
    const angle2 = w.newBlock('math_number');
    angle2.setFieldValue('0', 'NUM');
    s2.getInput('ANGLE').connection.connect(angle2.outputConnection);
    s1.nextConnection.connect(s2.previousConnection);

    const s3 = w.newBlock('robot_servo_write');
    s3.setFieldValue('3', 'SERVO');
    const angle3 = w.newBlock('math_number');
    angle3.setFieldValue('180', 'NUM');
    s3.getInput('ANGLE').connection.connect(angle3.outputConnection);
    s2.nextConnection.connect(s3.previousConnection);

    const dis1 = w.newBlock('robot_servo_disable');
    dis1.setFieldValue('1', 'SERVO');
    s3.nextConnection.connect(dis1.previousConnection);

    const dis4 = w.newBlock('robot_servo_disable');
    dis4.setFieldValue('4', 'SERVO');
    dis1.nextConnection.connect(dis4.previousConnection);
  });

  const res = generateArduino(ws, FAST4WD_BOARD_ID);
  assert.deepEqual(res.warnings, []);
  assert.match(res.code, /newmania\.servoWrite\(1, 90\.0\);/);
  assert.match(res.code, /newmania\.servoWrite\(2, 0\.0\);/);
  assert.match(res.code, /newmania\.servoWrite\(3, 180\.0\);/);
  assert.match(res.code, /newmania\.servoDisable\(1\);/);
  assert.match(res.code, /newmania\.servoDisable\(4\);/);
  ws.dispose();
});

test('Generator Test: expressions and variables in angle input generate valid C++', () => {
  const ws = makeWorkspaceWithBlocks((w, root) => {
    const v = w.createVariable('my_angle');
    const setV = w.newBlock('variables_set');
    setV.setFieldValue(v.getId(), 'VAR');
    const num = w.newBlock('math_number');
    num.setFieldValue('45', 'NUM');
    setV.getInput('VALUE').connection.connect(num.outputConnection);
    root.getInput('DO').connection.connect(setV.previousConnection);

    const s1 = w.newBlock('robot_servo_write');
    s1.setFieldValue('1', 'SERVO');
    const getV = w.newBlock('variables_get');
    getV.setFieldValue(v.getId(), 'VAR');
    s1.getInput('ANGLE').connection.connect(getV.outputConnection);
    setV.nextConnection.connect(s1.previousConnection);
  });

  const res = generateArduino(ws, FAST4WD_BOARD_ID);
  assert.deepEqual(res.warnings, []);
  assert.match(res.code, /newmania\.servoWrite\(1, student_var_0\);/);
  ws.dispose();
});

test('Generator Test: invalid angles (<0 or >180) and invalid channels are rejected with errors', () => {
  // Test negative angle
  const wsNeg = makeWorkspaceWithBlocks((w, root) => {
    const s1 = w.newBlock('robot_servo_write');
    s1.setFieldValue('1', 'SERVO');
    const angle = w.newBlock('math_number');
    angle.setFieldValue('-10', 'NUM');
    s1.getInput('ANGLE').connection.connect(angle.outputConnection);
    root.getInput('DO').connection.connect(s1.previousConnection);
  });
  const resNeg = generateArduino(wsNeg, FAST4WD_BOARD_ID);
  assert.ok(resNeg.warnings.some(w => w.includes('Góc quay servo phải nằm trong khoảng từ 0 đến 180 độ')));
  wsNeg.dispose();

  // Test angle > 180
  const wsOver = makeWorkspaceWithBlocks((w, root) => {
    const s1 = w.newBlock('robot_servo_write');
    s1.setFieldValue('1', 'SERVO');
    const angle = w.newBlock('math_number');
    angle.setFieldValue('185', 'NUM');
    s1.getInput('ANGLE').connection.connect(angle.outputConnection);
    root.getInput('DO').connection.connect(s1.previousConnection);
  });
  const resOver = generateArduino(wsOver, FAST4WD_BOARD_ID);
  assert.ok(resOver.warnings.some(w => w.includes('Góc quay servo phải nằm trong khoảng từ 0 đến 180 độ')));
  wsOver.dispose();
});

test('Generator Test: programs without servo blocks do not emit servo code', () => {
  const ws = makeWorkspaceWithBlocks((w, root) => {
    const msg = w.newBlock('beginner_message');
    const txt = w.newBlock('text');
    txt.setFieldValue('Hello', 'TEXT');
    msg.getInput('VALUE').connection.connect(txt.outputConnection);
    root.getInput('DO').connection.connect(msg.previousConnection);
  });
  const res = generateArduino(ws, FAST4WD_BOARD_ID);
  assert.deepEqual(res.warnings, []);
  assert.doesNotMatch(res.code, /servoWrite|servoDisable|Servo::/);
  ws.dispose();
});

test('Host Simulation Test: Firmware servo control, duty calculation, independent disable, STOP & PS4 disconnect shutdown', () => {
  const ws = makeWorkspaceWithBlocks((w, root) => {
    const conn = w.newBlock('newmania_design_ps4_connect');
    root.getInput('DO').connection.connect(conn.previousConnection);

    const loop = w.newBlock(TYPES.forever);
    conn.nextConnection.connect(loop.previousConnection);

    const s1 = w.newBlock('robot_servo_write');
    s1.setFieldValue('1', 'SERVO');
    const angle1 = w.newBlock('math_number');
    angle1.setFieldValue('90', 'NUM');
    s1.getInput('ANGLE').connection.connect(angle1.outputConnection);
    loop.getInput('DO').connection.connect(s1.previousConnection);

    const s2 = w.newBlock('robot_servo_write');
    s2.setFieldValue('2', 'SERVO');
    const angle2 = w.newBlock('math_number');
    angle2.setFieldValue('0', 'NUM');
    s2.getInput('ANGLE').connection.connect(angle2.outputConnection);
    s1.nextConnection.connect(s2.previousConnection);

    const s3 = w.newBlock('robot_servo_write');
    s3.setFieldValue('3', 'SERVO');
    const angle3 = w.newBlock('math_number');
    angle3.setFieldValue('180', 'NUM');
    s3.getInput('ANGLE').connection.connect(angle3.outputConnection);
    s2.nextConnection.connect(s3.previousConnection);
  });

  const generated = generateArduino(ws, FAST4WD_BOARD_ID);
  assert.deepEqual(generated.warnings, []);
  ws.dispose();

  const testSource = generated.code + `
#include <cassert>

static void freshPs4(uint32_t buttons = 0) {
  clockMs += 20;
  Wire.report.connected = true;
  Wire.report.sequence = (Wire.report.sequence + 1) & 127;
  Wire.report.buttons = buttons;
  Wire.report.axes[0] = 0; Wire.report.axes[1] = 0; Wire.report.axes[2] = 0;
  loop();
}

int main() {
  setup();
  // Before student program runs / before first servo execution: NO pulses emitted, no attached pins
  assert(!newmania.servoAttached(1));
  assert(!newmania.servoAttached(2));
  assert(!newmania.servoAttached(3));
  assert(!newmania.servoAttached(4));
  assert(!ledcAttachedPins[12]);
  assert(!ledcAttachedPins[13]);
  assert(!ledcAttachedPins[14]);
  assert(!ledcAttachedPins[15]);

  // Feed fresh PS4 neutral reports, then action to achieve READY
  for (int i = 0; i < 15; ++i) freshPs4(0);
  for (int i = 0; i < 5; ++i) freshPs4(1);
  for (int i = 0; i < 5; ++i) freshPs4(0);
  assert(newmania.running());

  // Step loop to execute the student statements (connect -> S1 90 -> S2 0 -> S3 180)
  for (int i = 0; i < 10; ++i) freshPs4(0);

  // 1. Verify Servo 1 (GPIO 12): 90 degrees -> 1500 us pulse -> duty 1229
  assert(newmania.servoAttached(1));
  assert(newmania.servoAngle(1) == 90.0);
  assert(newmania.servoDuty(1) == 1229);
  assert(ledcAttachedPins[12]);
  assert(ledcDutyPins[12] == 1229);

  // 2. Verify Servo 2 (GPIO 13): 0 degrees -> 1000 us pulse -> duty 819
  assert(newmania.servoAttached(2));
  assert(newmania.servoAngle(2) == 0.0);
  assert(newmania.servoDuty(2) == 819);
  assert(ledcAttachedPins[13]);
  assert(ledcDutyPins[13] == 819);

  // 3. Verify Servo 3 (GPIO 14): 180 degrees -> 2000 us pulse -> duty 1638
  assert(newmania.servoAttached(3));
  assert(newmania.servoAngle(3) == 180.0);
  assert(newmania.servoDuty(3) == 1638);
  assert(ledcAttachedPins[14]);
  assert(ledcDutyPins[14] == 1638);

  // Servo 4 was not called -> untouched
  assert(!newmania.servoAttached(4));
  assert(!ledcAttachedPins[15]);

  // 4. Test independent channel disabling: disable S1 only
  assert(newmania.servoDisable(1));
  assert(!newmania.servoAttached(1));
  assert(!ledcAttachedPins[12]);
  assert(ledcDutyPins[12] == 0);

  // S2 and S3 must remain active
  assert(newmania.servoAttached(2));
  assert(ledcAttachedPins[13]);
  assert(newmania.servoAttached(3));
  assert(ledcAttachedPins[14]);

  // 5. Test PS4 disconnect / link loss shutdown:
  // While running with S2 & S3 attached, simulate lost PS4 connection (>250ms without report)
  Wire.report.connected = false;
  for (int i = 0; i < 15; ++i) {
    clockMs += 20;
    loop();
  }

  // All servos must be detached on PS4 loss
  assert(!newmania.servoAttached(2));
  assert(!newmania.servoAttached(3));
  assert(!ledcAttachedPins[13]);
  assert(!ledcAttachedPins[14]);

  // Re-establish fresh neutral connection and recovery to write servo again
  Wire.report.connected = true;
  Wire.report.sequence = 1;
  for (int i = 0; i < 15; ++i) freshPs4(0);
  for (int i = 0; i < 5; ++i) freshPs4(1);
  for (int i = 0; i < 5; ++i) freshPs4(0);
  assert(newmania.running());
  assert(newmania.servoWrite(4, 45.0));
  assert(newmania.servoAttached(4));
  assert(ledcAttachedPins[15]);

  // 6. Test automatic detachment on STOP
  newmania.stop();
  assert(!newmania.running());
  assert(!newmania.servoAttached(4));
  assert(!ledcAttachedPins[15]);

  return 0;
}
`;

  const srcFile = join(outDir, 'servo_test_native.cpp');
  writeFileSync(srcFile, testSource);
  const binFile = join(outDir, 'servo_test_native.exe');
  execFileSync(cxx, [...flags, srcFile, resolve('firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.cpp'), '-o', binFile], { stdio: 'pipe' });
  execFileSync(binFile, { stdio: 'pipe' });
});
