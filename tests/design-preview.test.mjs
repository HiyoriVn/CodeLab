import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly';
import { TYPES, workspaceOptions, initializeDesign, designToolbox, designDiagnostics, exampleDesign, loadDesign, saveDesign, previewMotorTypes, unsupported } from '../src/design-preview/model.js';
import { generateArduino } from '../src/generators/arduino.js';
import { FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';

test('design root is unique, not deletable/copyable/duplicatable, and absent from toolbox',()=>{
  const w=new Blockly.Workspace(new Blockly.Options(workspaceOptions));
  const root=initializeDesign(w);
  assert.equal(root.hat,'cap');assert.equal(root.isDeletable(),false);assert.equal(root.isCopyable(),false);assert.equal(root.isDuplicatable(),false);
  assert.equal(w.remainingCapacityOfType(TYPES.root),0);
  assert.equal(root.previousConnection,null);assert.equal(root.nextConnection,null);
  assert.throws(()=>initializeDesign(w),/Không tự chuyển/);
  assert.ok(!designToolbox().contents.flatMap(c=>c.contents).some(b=>b.type===TYPES.root));
  w.dispose();
});

test('new design has eight categories, one motor entry per action and M1–M4 only',()=>{
  const toolbox=designToolbox();
  assert.deepEqual(toolbox.contents.map(c=>c.name),['Bắt đầu & Điều khiển','Logic','Toán học','Biến','Hiển thị / Serial','Motor','Di chuyển mecanum','Tay cầm PS4']);
  const motor=toolbox.contents.find(c=>c.name==='Motor').contents.filter(e=>e.kind==='block');
  assert.equal(motor.length,7);assert.equal(new Set(motor.map(b=>b.type)).size,7);
  const w=new Blockly.Workspace();
  for(const type of previewMotorTypes.values()) {
    const b=w.newBlock(type),selector=b.getField('MOTOR');
    if(selector)assert.deepEqual(selector.getOptions(false),[['M1','motor-1'],['M2','motor-2'],['M3','motor-3'],['M4','motor-4']]);
  }
  w.dispose();
});

test('forever is a terminal statement; PS4 has one parameter-free setup and three button states',()=>{
  const w=new Blockly.Workspace();
  const loop=w.newBlock(TYPES.forever),connect=w.newBlock(TYPES.connect),button=w.newBlock(TYPES.button);
  assert.ok(loop.previousConnection);assert.equal(loop.nextConnection,null);assert.ok(loop.getInput('DO'));
  assert.equal(connect.inputList.flatMap(i=>i.fieldRow).filter(f=>f.name).length,0);
  assert.deepEqual(button.getField('STATE').getOptions(false).map(([,value])=>value),['PRESS','HELD','RELEASE']);
  for(const state of ['PRESS','HELD','RELEASE']){button.setFieldValue(state,'STATE');assert.equal(button.getFieldValue('STATE'),state);}
  assert.equal(button.outputConnection.getCheck()[0],'Boolean');w.dispose();
});

test('three examples connect correctly, persist block and variable IDs, and restore root protection',()=>{
  for(const name of ['hold','count','drive']) {
    const payload=exampleDesign(name),before=JSON.stringify(payload),w=loadDesign(JSON.parse(before));
    assert.deepEqual(designDiagnostics(w),[],name);
    assert.equal(w.getAllBlocks(false).filter(b=>b.type===TYPES.root).length,1);
    assert.deepEqual(JSON.parse(JSON.stringify(saveDesign(w))),JSON.parse(before));
    assert.equal(w.getBlocksByType(TYPES.root)[0].isDeletable(),false);
    if(name==='count')assert.equal(w.getVariableMap().getAllVariables()[0].name,'đếm');
    w.dispose();assert.equal(JSON.stringify(payload),before);
  }
});

test('joystick example preserves selected axes LY, RX, LX without changing runtime',()=>{
  const w=loadDesign(exampleDesign('drive')),drive=w.getBlocksByType('robot_mecanum')[0];
  for(const [input,index] of [['FORWARD','1'],['LEFT','2'],['TURN','0']])assert.equal(drive.getInputTargetBlock(input).getFieldValue('AXIS'),index);
  w.dispose();
});

test('detached, nested loop and nested setup produce diagnostics without deleting data',()=>{
  const w=loadDesign(exampleDesign('hold'));
  const loop=w.getBlocksByType(TYPES.forever)[0];loop.unplug();
  assert.ok(designDiagnostics(w).some(i=>i.message.includes('cuối luồng')));
  const condition=w.newBlock('controls_if');loop.getInput('DO').connection.disconnect();loop.getInput('DO').connection.connect(condition.previousConnection);
  const connect=w.getBlocksByType(TYPES.connect)[0];connect.unplug();condition.getInput('DO0').connection.connect(connect.previousConnection);
  assert.ok(designDiagnostics(w).some(i=>i.id===connect.id&&i.message.includes('trực tiếp')));
  const before=JSON.stringify(saveDesign(w));designDiagnostics(w);assert.equal(JSON.stringify(saveDesign(w)),before);w.dispose();
});

test('unsupported entries are locked; existing blocks remain registered and diagnosed',()=>{
  const entries=designToolbox().contents.flatMap(c=>c.contents),w=new Blockly.Workspace();
  for(const [type] of unsupported){assert.ok(Blockly.Blocks[type],type);assert.ok(entries.filter(e=>e.type===type).every(e=>e.disabled===true),type);}
  initializeDesign(w);const unsupportedBlock=w.newBlock('beginner_led');
  assert.ok(designDiagnostics(w).some(i=>i.id===unsupportedBlock.id&&i.message.includes('kết nối/an toàn')));
  w.dispose();
});

test('legacy projects are rejected by design importer intact and still use existing generator',()=>{
  const w=new Blockly.Workspace(),event=w.newBlock('robot_ps4_event');
  const legacy={format:'codelab-project',version:1,project:{boardId:FAST4WD_BOARD_ID,workspace:Blockly.serialization.workspaces.save(w)}};
  const before=JSON.stringify(legacy);assert.throws(()=>loadDesign(legacy),/không bị chuyển đổi/);assert.equal(JSON.stringify(legacy),before);
  const devices=defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID));
  assert.deepEqual(generateArduino(w,FAST4WD_BOARD_ID,devices).warnings,[]);assert.equal(event.type,'robot_ps4_event');w.dispose();
});

test('malformed multiple roots are reported and preserved, not silently repaired',()=>{
  const w=new Blockly.Workspace();initializeDesign(w);w.newBlock(TYPES.root);
  const before=JSON.stringify(saveDesign(w));assert.ok(designDiagnostics(w).some(i=>i.message.includes('đúng một khối gốc')));assert.equal(JSON.stringify(saveDesign(w)),before);w.dispose();
});

test('design entry stays separate from production application and generator registration',()=>{
  const app=readFileSync('src/App.jsx','utf8'),main=readFileSync('src/main.jsx','utf8');
  assert.doesNotMatch(app+main,/design-preview/);
  assert.match(readFileSync('src/design-preview/main.js','utf8'),/if \(import.meta.env.DEV\)/);
  assert.doesNotMatch(readFileSync('src/design-preview/editor.js','utf8'),/generateArduino|\/api\/|BrowserFlasher|DevicePanel/);
});


test('pre-created root emits no undoable creation event',async()=>{
  const w=new Blockly.Workspace(new Blockly.Options(workspaceOptions)),events=[];
  w.addChangeListener(e=>events.push(e));initializeDesign(w);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(!events.some(e=>e.type===Blockly.Events.BLOCK_CREATE));
  assert.equal(w.getBlocksByType(TYPES.root).length,1);w.dispose();
});
