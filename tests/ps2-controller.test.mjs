import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly';
import { FAST4WD_BOARD_ID, V2_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';
import { TYPES, designToolbox, newmaniaWorkspace } from '../src/blocks/newmania.js';
import { generateNewmania } from '../src/generators/newmania.js';

function project(boardId) {
  const workspace = new Blockly.Workspace();
  workspace.codelabBoardId = boardId;
  workspace.codelabRobotDevices = defaultRobotDevices(getBoardProfile(boardId));
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), workspace);
  const root = workspace.getBlocksByType(TYPES.root, false)[0];
  const connect = workspace.newBlock(TYPES.connect);
  root.getInput('DO').connection.connect(connect.previousConnection);
  return { workspace, connect };
}

test('PS2 controller appears only on Newmania V2 and uses the V2 SPI pins', () => {
  const v2 = getBoardProfile(V2_BOARD_ID);
  assert.deepEqual(v2.pins.spi, { sck:12, mosi:11, miso:13, cs:10 });
  const toolbox = designToolbox(V2_BOARD_ID);
  assert.ok(toolbox.contents.some(category => category.name === 'Tay cầm PS4 / PS2'));
  const { workspace, connect } = project(V2_BOARD_ID);
  assert.deepEqual(connect.getField('TRANSPORT').getOptions(false).map(([, value]) => value),
    ['UART', 'I2C', 'PS2']);
  connect.setFieldValue('PS2', 'TRANSPORT');
  assert.equal(connect.getFieldValue('TRANSPORT'), 'PS2');
  const saved = Blockly.serialization.workspaces.save(workspace);
  assert.match(JSON.stringify(saved), /"TRANSPORT":"PS2"/);
  workspace.dispose();
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
    ['PS2', /codelab::fast4wd::Ps4Transport::Ps2Spi/],
  ]) {
    connect.setFieldValue(choice, 'TRANSPORT');
    const result = generateNewmania(workspace, V2_BOARD_ID, devices);
    assert.deepEqual(result.warnings, [], result.code || result.warnings.join('\n'));
    assert.match(result.code, expected);
    if (choice === 'PS2') assert.match(result.code, /newmania\.connectController\(\);/);
    else assert.match(result.code, /newmania\.connectPs4\(\);/);
  }
  workspace.dispose();
});

test('PS2 SPI driver is bundled with the browser firmware libraries and existing input failsafe', () => {
  const payload = JSON.parse(readFileSync('public/toolchain-337/codelab-poc-data.json', 'utf8'));
  const ps2 = readFileSync('firmware/libraries/CodeLabPs4I2C/src/Ps2Spi.h', 'utf8');
  const fast = readFileSync('firmware/libraries/CodeLabFast4wd/src/CodeLabFast4wd.h', 'utf8');
  const library = payload.libraries.find(item => item.id === 'CodeLabPs4I2C');
  assert.equal(library.files.find(item => item.path === 'src/Ps2Spi.h').content, ps2);
  assert.match(ps2, /decodePs2Analog/);
  for (const pin of ['kClock = 12','kCommand = 11','kData = 13','kAttention = 10'])
    assert.ok(ps2.includes(pin));
  assert.match(fast, /transport_ == Ps4Transport::Ps2Spi/);
  assert.match(fast, /receiver_\.ingest\(bytes, sizeof\(bytes\), millis\(\)\)/);
  assert.match(fast, /updateBlocklyLink\(millis\(\)\)/);
});
