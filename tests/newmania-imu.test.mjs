import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Blockly from 'blockly';
import { V2_BOARD_ID, FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';
import { designToolbox, TYPES, newmaniaWorkspace } from '../src/blocks/newmania.js';
import { generateNewmania } from '../src/generators/newmania.js';
import { inspectElf, verifyImage } from '../src/compiler/inspect-firmware.js';

function makeProgram(boardId, controller = null) {
  const w = new Blockly.Workspace();
  w.codelabBoardId = boardId;
  w.codelabRobotDevices = defaultRobotDevices(getBoardProfile(boardId));
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), w);
  const root = w.getBlocksByType(TYPES.root, false)[0];
  let previous;
  if (controller) {
    const c = w.newBlock(controller === 'PS2' ? TYPES.ps2Connect : TYPES.connect);
    if (controller === 'I2C') c.setFieldValue('I2C', 'TRANSPORT');
    root.getInput('DO').connection.connect(c.previousConnection);
    previous = c;
  }
  const init = w.newBlock(TYPES.imuInit);
  if (previous) previous.nextConnection.connect(init.previousConnection);
  else root.getInput('DO').connection.connect(init.previousConnection);
  const loop = w.newBlock(TYPES.forever);
  init.nextConnection.connect(loop.previousConnection);
  const sample = w.newBlock(TYPES.imuSample);
  loop.getInput('DO').connection.connect(sample.previousConnection);
  const ifBlock = w.newBlock('controls_if');
  sample.nextConnection.connect(ifBlock.previousConnection);
  const ready = w.newBlock(TYPES.imuReady);
  ifBlock.getInput('IF0').connection.connect(ready.outputConnection);
  const print = w.newBlock('codelab_serial_print');
  const value = w.newBlock(TYPES.imuValue);
  value.setFieldValue('GyroZ', 'CHANNEL');
  print.getInput('VALUE').connection.connect(value.outputConnection);
  ifBlock.getInput('DO0').connection.connect(print.previousConnection);
  return w;
}

test('Newmania V2 alone exposes an IMU category, with typed init/sample/ready/6-axis blocks', () => {
  const v2 = designToolbox(V2_BOARD_ID);
  const cat = v2.contents.find(c => c.name === 'Cảm biến IMU');
  assert.ok(cat, 'V2 must have an IMU category');
  assert.deepEqual(cat.contents.map(c => c.type), [TYPES.imuInit,TYPES.imuSample,TYPES.imuReady,TYPES.imuValue]);
  assert.equal(designToolbox(FAST4WD_BOARD_ID).contents.some(c=>c.name==='Cảm biến IMU'), false);
  const w = new Blockly.Workspace();
  const ready = w.newBlock(TYPES.imuReady), value = w.newBlock(TYPES.imuValue);
  assert.deepEqual(ready.outputConnection.getCheck(), ['Boolean']);
  assert.deepEqual(value.outputConnection.getCheck(), ['Number']);
  assert.deepEqual(value.getField('CHANNEL').getOptions(false).map(([,v])=>v), ['AccX','AccY','AccZ','GyroX','GyroY','GyroZ']);
  w.dispose();
});

test('Generator produces QMI8658 API calls and works on V2 with PS4 I2C and PS2 SPI', () => {
  for (const controller of [null, 'I2C', 'PS2']) {
    const w = makeProgram(V2_BOARD_ID, controller);
    const out = generateNewmania(w, V2_BOARD_ID, defaultRobotDevices(getBoardProfile(V2_BOARD_ID)));
    assert.deepEqual(out.warnings, []);
    for(const expected of ['newmania.imuBegin();','newmania.imuSample();','newmania.imuReady()','newmania.imuValue(ImuChannel::GyroZ)'])
      assert.ok(out.code.includes(expected), expected);
    if(controller==='I2C') assert.match(out.code, /Ps4Transport::I2c/);
    if(controller==='PS2') assert.match(out.code, /Ps4Transport::Ps2Spi/);
    w.dispose();
  }
});

test('V1 rejects IMU blocks; V2 rejects reading without initialization', () => {
  const v1 = makeProgram(FAST4WD_BOARD_ID);
  assert.match(generateNewmania(v1, FAST4WD_BOARD_ID).warnings.join(' '), /chỉ hỗ trợ Newmania V2/);
  v1.dispose();
  const v2 = new Blockly.Workspace();
  v2.codelabBoardId=V2_BOARD_ID;
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), v2);
  const root=v2.getBlocksByType(TYPES.root,false)[0];
  const sample=v2.newBlock(TYPES.imuSample);
  root.getInput('DO').connection.connect(sample.previousConnection);
  assert.match(generateNewmania(v2,V2_BOARD_ID).warnings.join(' '), /Thêm Khởi tạo IMU/);
  v2.dispose();
});

test('WASM bundle contains latest QMI8658B header and revision', () => {
  const payload=JSON.parse(readFileSync('public/toolchain-337/codelab-poc-data.json','utf8'));
  const manifest=JSON.parse(readFileSync('public/toolchain-337/manifest.json','utf8'));
  const lib=payload.libraries.find(l=>l.id==='CodeLabFast4wd');
  assert.equal(payload.libraryRevision,manifest.libraryRevision);
  const h=readFileSync('firmware/libraries/CodeLabFast4wd/src/Qmi8658.h','utf8').replaceAll('\r\n','\n');
  assert.equal(lib.files.find(f=>f.path==='src/Qmi8658.h').content,h);
  assert.match(h,/kAddress = 0x6A, kSda = 8, kScl = 9/);
  assert.match(h,/who != 0x05/);
  assert.match(h,/kAccXLow = 0x35/);
  for(const f of ['CodeLabNewmania.h','CodeLabFast4wd.h'])
    assert.equal(lib.files.find(x=>x.path==='src/'+f).content,
      readFileSync('firmware/libraries/CodeLabFast4wd/src/'+f,'utf8').replaceAll('\r\n','\n'));
});

test('Real WASM compiler creates valid ESP32-S3 V2 firmware for IMU', async () => {
  const w = makeProgram(V2_BOARD_ID);
  const generated = generateNewmania(w, V2_BOARD_ID);
  w.dispose();
  assert.deepEqual(generated.warnings, []);
  const oldSelf=globalThis.self, oldFetch=globalThis.fetch;
  globalThis.self=globalThis;
  self.location={href:'http://localhost/'};
  globalThis.fetch=async url=>{
    const filename=join(process.cwd(),'public',new URL(url,self.location.href).pathname);
    try{return new Response(readFileSync(filename));}catch{return new Response('',{status:404});}
  };
  let result;
  self.postMessage=msg=>{if(msg.type!=='progress')result=msg;};
  try {
    await import('../src/compiler/browser-compiler.worker.js');
    await self.onmessage({data:{action:'compile',requestId:416,code:generated.code,boardId:V2_BOARD_ID}});
    assert.equal(result?.type,'done',result?.error||'V2 IMU WASM compile failed');
    assert.equal(result?.manifest?.boardId,V2_BOARD_ID);
    const elf=result.debug.elf;
    const app=result.segments.find(segment=>segment.address===0x10000).data;
    assert.ok(inspectElf(elf).constructors.some(c=>c.name==='_GLOBAL__sub_I_sketch.ino'));
    await verifyImage(elf,app);
  } finally {globalThis.self=oldSelf;globalThis.fetch=oldFetch;}
});
