import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Blockly from 'blockly';
import { V2_BOARD_ID, FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';
import { designToolbox, newmaniaWorkspace, previewMotorTypes, TYPES } from '../src/blocks/newmania.js';
import { lessonProject } from '../src/lessons/newmania.js';
import { generateNewmania } from '../src/generators/newmania.js';
import { validatePackage, sha256 } from '../src/device/firmware-package.js';
import { flashPackage } from '../src/device/browser-flash.js';
import { inspectElf, verifyImage } from '../src/compiler/inspect-firmware.js';

test('V2 board profile Newmania V2 ESP32S3 has exact 6M, 6S, encoder metadata, 8MB/no-PSRAM and zero GPIO conflict', () => {
  const v2 = getBoardProfile(V2_BOARD_ID);
  assert.equal(v2.name, 'Newmania V2 ESP32S3');
  assert.equal(v2.mcu, 'ESP32-S3-MINI-1-N8');
  assert.equal(v2.flashMB, 8);
  assert.equal(v2.psramMB, 0);
  assert.match(v2.build.fqbn, /FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled/);
  assert.deepEqual(v2.pins.motors, [[42,41],[40,39],[38,37],[36,35],[48,34],[33,47]]);
  assert.deepEqual(v2.pins.servos, [14,15,16,17,18,21]);
  assert.deepEqual(v2.pins.encoders, [[1,2],[4,5]]);
  assert.deepEqual(v2.pins.uart1, { tx: 6, rx: 7 });
  assert.deepEqual(v2.pins.i2c, { sda: 8, scl: 9 });
  assert.equal(v2.pins.imuAddress, 0x6A);

  const usedPins = [
    ...v2.pins.motors.flat(),
    ...v2.pins.servos,
    ...v2.pins.encoders.flat(),
    v2.pins.uart1.tx, v2.pins.uart1.rx,
    v2.pins.i2c.sda, v2.pins.i2c.scl,
    ...v2.pins.usb,
  ];
  assert.equal(new Set(usedPins).size, usedPins.length, 'All V2 physical GPIOs must be disjoint');
});

test('V2 Blockly toolbox exposes M1-M6, S1-S6, PS4 UART/I2C dropdown and no encoder/PID blocks', () => {
  const toolbox = designToolbox(V2_BOARD_ID);
  const motorCat = toolbox.contents.find((c) => c.name === 'Motor');
  const servoCat = toolbox.contents.find((c) => c.name === 'Servo');
  assert.ok(motorCat && servoCat);
  assert.ok(!toolbox.contents.some((c) => /encoder|pid/i.test(c.name)));

  const w = new Blockly.Workspace();
  w.codelabBoardId = V2_BOARD_ID;
  w.codelabRobotDevices = defaultRobotDevices(getBoardProfile(V2_BOARD_ID));

  const mBlock = w.newBlock(previewMotorTypes.get('robot_motor_power'));
  assert.deepEqual(mBlock.getField('MOTOR').getOptions(false).map(([, id]) => id), ['motor-1','motor-2','motor-3','motor-4','motor-5','motor-6']);

  const sWrite = w.newBlock('robot_servo_write');
  assert.deepEqual(sWrite.getField('SERVO').getOptions(false), [['S1','1'],['S2','2'],['S3','3'],['S4','4'],['S5','5'],['S6','6']]);

  const connect = w.newBlock(TYPES.connect);
  assert.deepEqual(connect.getField('TRANSPORT').getOptions(false), [['PS4 UART','UART'],['PS4 I²C','I2C'],['PS2 SPI','PS2']]);
  w.dispose();
});

test('V2 generator emits BoardVariant::V2, M5/M6, S6, and distinct UART vs I2C PS4 initialization', () => {
  const v2 = getBoardProfile(V2_BOARD_ID);
  const devices = defaultRobotDevices(v2);
  assert.equal(devices.motors.length, 6);
  assert.equal(devices.drivetrain.wheels.length, 4);
  assert.equal(devices.controller.blink, false);

  const w = new Blockly.Workspace();
  w.codelabBoardId = V2_BOARD_ID;
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), w);
  w.codelabBoardId = V2_BOARD_ID;
  w.codelabRobotDevices = devices;
  const root = w.getBlocksByType(TYPES.root, false)[0];
  const connect = w.newBlock(TYPES.connect);
  const m5 = w.newBlock(previewMotorTypes.get('robot_motor_power'));
  m5.setFieldValue('motor-5', 'MOTOR');
  const p5 = w.newBlock('math_number'); p5.setFieldValue(65, 'NUM');
  m5.getInput('POWER').connection.connect(p5.outputConnection);
  const s6 = w.newBlock('robot_servo_write');
  s6.setFieldValue('6', 'SERVO');
  const a6 = w.newBlock('math_number'); a6.setFieldValue(150, 'NUM');
  s6.getInput('ANGLE').connection.connect(a6.outputConnection);
  const s6Off = w.newBlock('robot_servo_disable');
  s6Off.setFieldValue('6', 'SERVO');

  root.getInput('DO').connection.connect(connect.previousConnection);
  connect.nextConnection.connect(m5.previousConnection);
  m5.nextConnection.connect(s6.previousConnection);
  s6.nextConnection.connect(s6Off.previousConnection);

  const uartOut = generateNewmania(w, V2_BOARD_ID, devices);
  assert.deepEqual(uartOut.warnings, []);
  assert.match(uartOut.code, /static Board newmania\(100, \{\{0, 1, 2, 3\}, 3, 63\}, codelab::fast4wd::BoardVariant::V2\);/);
  assert.match(uartOut.code, /newmania\.power\(Motor::M5, 65\.0\);/);
  assert.match(uartOut.code, /newmania\.servoWrite\(6, 150\.0\);/);
  assert.match(uartOut.code, /newmania\.servoDisable\(6\);/);
  assert.doesNotMatch(uartOut.code, /Ps4Transport::I2c/);

  connect.setFieldValue('I2C', 'TRANSPORT');
  const i2cOut = generateNewmania(w, V2_BOARD_ID, devices);
  assert.deepEqual(i2cOut.warnings, []);
  assert.match(i2cOut.code, /codelab::fast4wd::Ps4Transport::I2c/);
  w.dispose();
});

test('Firmware C++ headers map 6 MCPWM timers cleanly and reserve GPIO47 on V2', () => {
  const mcpwm = readFileSync('firmware/libraries/CodeLabFast4wd/src/Esp32Mcpwm.h', 'utf8');
  for (const pair of ['fi==42&&bi==41','fi==40&&bi==39','fi==38&&bi==37','fi==36&&bi==35','fi==48&&bi==34','fi==33&&bi==47']) {
    assert.ok(mcpwm.includes(pair), `Missing V2 MCPWM pair ${pair}`);
  }
  const fast4wd = readFileSync('firmware/libraries/CodeLabFast4wd/src/CodeLabFast4wd.h', 'utf8');
  assert.match(fast4wd, /blink_ = \(variant_ == BoardVariant::V1\) && blinkOnLoss;/);
  assert.match(fast4wd, /rxPin = \(variant_ == BoardVariant::V2\) \? 7 : ps4i2c::uartRxPin/);
  assert.match(fast4wd, /txPin = \(variant_ == BoardVariant::V2\) \? 6 : ps4i2c::uartTxPin/);

  const newmania = readFileSync('firmware/libraries/CodeLabFast4wd/src/CodeLabNewmania.h', 'utf8');
  assert.match(newmania, /kServoPinsV2\[6\] = \{14, 15, 16, 17, 18, 21\}/);
});

test('WASM compiler builds V2 8MB firmware package and flashPackage enforces 8MB flash for V2', async () => {
  const v2 = getBoardProfile(V2_BOARD_ID);
  const w = new Blockly.Workspace();
  w.codelabBoardId = V2_BOARD_ID;
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), w);
  const root = w.getBlocksByType(TYPES.root, false)[0];
  const s6 = w.newBlock('robot_servo_write');
  s6.setFieldValue('6', 'SERVO');
  const a6 = w.newBlock('math_number'); a6.setFieldValue(90, 'NUM');
  s6.getInput('ANGLE').connection.connect(a6.outputConnection);
  root.getInput('DO').connection.connect(s6.previousConnection);
  const generated = generateNewmania(w, V2_BOARD_ID, defaultRobotDevices(v2));
  w.dispose();

  const oldSelf = globalThis.self;
  const oldFetch = globalThis.fetch;
  globalThis.self = globalThis;
  self.location = { href: 'http://localhost/' };
  globalThis.fetch = async (url) => {
    const filename = join(process.cwd(), 'public', new URL(url, self.location.href).pathname);
    try { return new Response(readFileSync(filename)); }
    catch { return new Response('', { status: 404 }); }
  };
  let workerResult;
  self.postMessage = (msg) => { if (msg.type !== 'progress') workerResult = msg; };
  try {
    await import('../src/compiler/browser-compiler.worker.js');
    await self.onmessage({ data: { action: 'compile', requestId: 202, code: generated.code, boardId: V2_BOARD_ID } });
    assert.equal(workerResult?.type, 'done', workerResult?.error || 'V2 WASM compile failed');
    assert.equal(workerResult.manifest.boardId, V2_BOARD_ID);
    assert.equal(workerResult.manifest.fqbn, v2.build.fqbn);
    const elf = workerResult.debug.elf;
    const app = workerResult.segments.find((s) => s.address === 0x10000).data;
    assert.ok(inspectElf(elf).constructors.some((c) => c.name === '_GLOBAL__sub_I_sketch.ino'));
    await verifyImage(elf, app);

    // flashPackage with V2 8MB must reject a 16MB board and accept an 8MB board
    const makeLoader = (detectedSize) => async () => ({
      Transport: class { async disconnect() {} },
      ESPLoader: class {
        chip = { CHIP_NAME: 'ESP32-S3' };
        async main() {}
        async detectFlashSize() { return detectedSize; }
        async readFlash(addr) { return workerResult.segments.find((s) => s.address === addr).data; }
        async writeFlash() {}
      },
    });
    await assert.rejects(
      () => flashPackage({}, workerResult.segments, () => {}, () => {}, makeLoader('16MB'), { expectedFlashSize: '8MB' }),
      /Flash không phải 8MB/
    );
    await flashPackage({}, workerResult.segments, () => {}, () => {}, makeLoader('8MB'), { expectedFlashSize: '8MB' });
  } finally {
    globalThis.self = oldSelf;
    globalThis.fetch = oldFetch;
  }

  // V1 remains 4M/4S/16MB
  const v1 = getBoardProfile(FAST4WD_BOARD_ID);
  assert.equal(v1.flashMB, 16);
  assert.equal(v1.capabilities.motorChannels, 4);
  assert.equal(v1.capabilities.servoChannels, 4);
});

test('Lesson 06 supports S1-S6 on V2 while keeping S1-S4 on V1', () => {
  const v2Proj = lessonProject('servo_test', V2_BOARD_ID);
  assert.equal(v2Proj.boardId, V2_BOARD_ID);
  const w2 = new Blockly.Workspace();
  w2.codelabBoardId = V2_BOARD_ID;
  Blockly.serialization.workspaces.load(v2Proj.workspace, w2);
  const out2 = generateNewmania(w2, v2Proj.boardId, v2Proj.deviceConfigs[V2_BOARD_ID]);
  w2.dispose();
  assert.deepEqual(out2.warnings, []);
  for (const ch of [1, 2, 3, 4, 5, 6]) {
    assert.match(out2.code, new RegExp(`newmania\\.servoWrite\\(${ch}, 90\\.0\\)`));
    assert.match(out2.code, new RegExp(`newmania\\.servoDisable\\(${ch}\\)`));
  }

  const v1Proj = lessonProject('servo_test');
  assert.equal(v1Proj.boardId, FAST4WD_BOARD_ID);
  const w1 = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(v1Proj.workspace, w1);
  const out1 = generateNewmania(w1, v1Proj.boardId, v1Proj.deviceConfigs[FAST4WD_BOARD_ID]);
  w1.dispose();
  assert.deepEqual(out1.warnings, []);
  assert.match(out1.code, /newmania\.servoWrite\(4, 90\.0\)/);
  assert.doesNotMatch(out1.code, /newmania\.servoWrite\(5,/);
});
