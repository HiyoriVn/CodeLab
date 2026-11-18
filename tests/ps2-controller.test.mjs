import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Blockly from 'blockly';
import { FAST4WD_BOARD_ID, V2_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';
import { TYPES, designToolbox, newmaniaWorkspace, previewMotorTypes } from '../src/blocks/newmania.js';
import { generateNewmania } from '../src/generators/newmania.js';
import { inspectElf, verifyImage } from '../src/compiler/inspect-firmware.js';

function project(boardId, connectType = TYPES.connect) {
  const workspace = new Blockly.Workspace();
  workspace.codelabBoardId = boardId;
  workspace.codelabRobotDevices = defaultRobotDevices(getBoardProfile(boardId));
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), workspace);
  const root = workspace.getBlocksByType(TYPES.root, false)[0];
  const connect = workspace.newBlock(connectType);
  root.getInput('DO').connection.connect(connect.previousConnection);
  return { workspace, connect };
}

test('PS2 controller appears only on Newmania V2 as a separate category and uses the V2 SPI pins', () => {
  const v2 = getBoardProfile(V2_BOARD_ID);
  assert.deepEqual(v2.pins.spi, { sck:12, mosi:11, miso:13, cs:10 });
  const v2Toolbox = designToolbox(V2_BOARD_ID);
  const ps4Cat = v2Toolbox.contents.find(category => category.name === 'Tay cầm PS4');
  const ps2Cat = v2Toolbox.contents.find(category => category.name === 'Tay cầm PS2');
  assert.ok(ps4Cat && ps2Cat, 'V2 toolbox must separate Tay cầm PS4 and Tay cầm PS2');
  assert.ok(ps4Cat.contents.some(b => b.type === TYPES.connect));
  assert.ok(ps2Cat.contents.some(b => b.type === TYPES.ps2Connect));
  assert.ok(ps2Cat.contents.some(b => b.type === TYPES.ps2Button));
  assert.ok(ps2Cat.contents.some(b => b.type === TYPES.ps2Axis));
  assert.ok(ps2Cat.contents.some(b => b.type === TYPES.ps2Connected));
  const ps4Only = new Set([TYPES.button, 'robot_ps4_axis', 'fast4wd_connected']);
  assert.ok(ps2Cat.contents.every(b => !ps4Only.has(b.type)), 'PS2 toolbox must contain no PS4 read blocks');

  const { workspace, connect } = project(V2_BOARD_ID);
  assert.deepEqual(connect.getField('TRANSPORT').getOptions(false).map(([, value]) => value),
    ['UART', 'I2C']);
  workspace.dispose();

  const v2Ps2 = project(V2_BOARD_ID, TYPES.ps2Connect);
  const saved = Blockly.serialization.workspaces.save(v2Ps2.workspace);
  assert.match(JSON.stringify(saved), /"type":"newmania_design_ps2_connect"/);
  v2Ps2.workspace.dispose();

  const v1Toolbox = designToolbox(FAST4WD_BOARD_ID);
  assert.ok(v1Toolbox.contents.some(category => category.name === 'Tay cầm PS4'));
  assert.ok(!v1Toolbox.contents.some(category => category.name === 'Tay cầm PS2'));
  const v1 = project(FAST4WD_BOARD_ID);
  assert.deepEqual(v1.connect.getField('TRANSPORT').getOptions(false).map(([,value]) => value),
    ['UART','I2C']);
  v1.workspace.dispose();
});

test('PS2 generates dedicated PS2 SPI transport while PS4 UART/I2C stay unchanged', () => {
  const { workspace, connect } = project(V2_BOARD_ID);
  const devices = defaultRobotDevices(getBoardProfile(V2_BOARD_ID));
  for (const [choice, expected] of [
    ['UART', /newmania\.begin\([^;]*\);/],
    ['I2C', /codelab::fast4wd::Ps4Transport::I2c/],
  ]) {
    connect.setFieldValue(choice, 'TRANSPORT');
    const result = generateNewmania(workspace, V2_BOARD_ID, devices);
    assert.deepEqual(result.warnings, [], result.code || result.warnings.join('\n'));
    assert.match(result.code, expected);
    assert.match(result.code, /newmania\.connectPs4\(\);/);
  }
  workspace.dispose();

  const ps2Proj = project(V2_BOARD_ID, TYPES.ps2Connect);
  const ps2Button = ps2Proj.workspace.newBlock(TYPES.ps2Button);
  ps2Button.setFieldValue('8', 'BUTTON'); // PS2 SELECT maps to internal Share bit.
  ps2Button.setFieldValue('HELD', 'STATE');
  const ps2Axis = ps2Proj.workspace.newBlock(TYPES.ps2Axis);
  const ps2Connected = ps2Proj.workspace.newBlock(TYPES.ps2Connected);
  assert.equal(ps2Button.outputConnection.getCheck()[0], 'Boolean');
  assert.equal(ps2Axis.outputConnection.getCheck()[0], 'Number');
  assert.equal(ps2Connected.outputConnection.getCheck()[0], 'Boolean');
  // No dangling blocks: connect one PS2 expression at a time.
  ps2Axis.dispose();
  ps2Connected.dispose();
  const loop = ps2Proj.workspace.newBlock(TYPES.forever);
  ps2Proj.connect.nextConnection.connect(loop.previousConnection);
  const condition = ps2Proj.workspace.newBlock('controls_if');
  condition.getInput('IF0').connection.connect(ps2Button.outputConnection);
  loop.getInput('DO').connection.connect(condition.previousConnection);
  const ps2Result = generateNewmania(ps2Proj.workspace, V2_BOARD_ID, devices);
  assert.deepEqual(ps2Result.warnings, [], ps2Result.code || ps2Result.warnings.join('\n'));
  assert.match(ps2Result.code, /codelab::fast4wd::Ps4Transport::Ps2Spi/);
  assert.match(ps2Result.code, /newmania\.connectController\(\);/);
  assert.match(ps2Result.code, /newmania\.held\(Button::Share\)/);
  condition.getInput('IF0').connection.disconnect();
  ps2Button.dispose();
  const connected = ps2Proj.workspace.newBlock(TYPES.ps2Connected);
  condition.getInput('IF0').connection.connect(connected.outputConnection);
  const connectedCode = generateNewmania(ps2Proj.workspace, V2_BOARD_ID, devices);
  assert.deepEqual(connectedCode.warnings, []);
  assert.match(connectedCode.code, /newmania\.connected\(\)/);
  condition.getInput('IF0').connection.disconnect();
  connected.dispose();
  const cmp = ps2Proj.workspace.newBlock('logic_compare');
  const axis = ps2Proj.workspace.newBlock(TYPES.ps2Axis);
  axis.setFieldValue('3', 'AXIS');
  const zero = ps2Proj.workspace.newBlock('math_number');
  zero.setFieldValue(0, 'NUM');
  cmp.getInput('A').connection.connect(axis.outputConnection);
  cmp.getInput('B').connection.connect(zero.outputConnection);
  condition.getInput('IF0').connection.connect(cmp.outputConnection);
  const axisCode = generateNewmania(ps2Proj.workspace, V2_BOARD_ID, devices);
  assert.deepEqual(axisCode.warnings, []);
  assert.match(axisCode.code, /newmania\.axis\(Axis::RightY\)/);
  ps2Proj.workspace.dispose();
});

test('PS2 SPI driver is bundled with the browser firmware libraries and existing input failsafe', () => {
  const payload = JSON.parse(readFileSync('public/toolchain-337/codelab-poc-data.json', 'utf8'));
  const ps2 = readFileSync('firmware/libraries/CodeLabPs4I2C/src/Ps2Spi.h', 'utf8');
  const fast = readFileSync('firmware/libraries/CodeLabFast4wd/src/CodeLabFast4wd.h', 'utf8');
  const library = payload.libraries.find(item => item.id === 'CodeLabPs4I2C');
  assert.equal(library.files.find(item => item.path === 'src/Ps2Spi.h').content, ps2.replaceAll('\r\n', '\n'));
  assert.match(ps2, /decodePs2Analog/);
  for (const pin of ['kClock = 12','kCommand = 11','kData = 13','kAttention = 10'])
    assert.ok(ps2.includes(pin));
  assert.match(fast, /transport_ == Ps4Transport::Ps2Spi/);
  assert.match(fast, /receiver_\.ingest\(bytes, sizeof\(bytes\), millis\(\)\)/);
  assert.match(fast, /updateBlocklyLink\(millis\(\)\)/);
});

test('V2 PS2 SPI sketch compiles via WASM into valid 8MB ESP32-S3 firmware', async () => {
  const { workspace, connect } = project(V2_BOARD_ID, TYPES.ps2Connect);
  const m5 = workspace.newBlock(previewMotorTypes.get('robot_motor_power'));
  m5.setFieldValue('motor-5', 'MOTOR');
  const p5 = workspace.newBlock('math_number'); p5.setFieldValue(40, 'NUM');
  m5.getInput('POWER').connection.connect(p5.outputConnection);
  connect.nextConnection.connect(m5.previousConnection);
  const generated = generateNewmania(workspace, V2_BOARD_ID, defaultRobotDevices(getBoardProfile(V2_BOARD_ID)));
  workspace.dispose();
  assert.deepEqual(generated.warnings, []);
  assert.match(generated.code, /Ps4Transport::Ps2Spi/);

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
    await self.onmessage({ data: { action: 'compile', requestId: 303, code: generated.code, boardId: V2_BOARD_ID } });
    assert.equal(workerResult?.type, 'done', workerResult?.error || 'V2 PS2 WASM compile failed');
    const elf = workerResult.debug.elf;
    const app = workerResult.segments.find((s) => s.address === 0x10000).data;
    assert.ok(inspectElf(elf).constructors.some((c) => c.name === '_GLOBAL__sub_I_sketch.ino'));
    await verifyImage(elf, app);
  } finally {
    globalThis.self = oldSelf;
    globalThis.fetch = oldFetch;
  }
});
