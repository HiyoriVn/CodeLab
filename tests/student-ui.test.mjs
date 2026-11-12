import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/beginner.js';
import '../src/blocks/robotics.js';
import '../src/blocks/controller.js';
import { editorToolbox } from '../src/blocks/beginner-toolbox.js';
import { generateArduino } from '../src/generators/arduino.js';
import { clearOldProjectsOnce, projectRobotDevices, newmaniaCopy, newmaniaCompatibility } from '../src/ui/project-storage.js';

test('old projects and legacy workspaces survive every launch', () => {
  const data = new Map([['codelab.projects.v1','old'], ['codelab.workspace.v1','old']]);
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  clearOldProjectsOnce(storage);
  assert.equal(data.get('codelab.projects.v1'), 'old');
  assert.equal(data.get('codelab.workspace.v1'), 'old');
  data.set('codelab.projects.v1','new'); clearOldProjectsOnce(storage);
  assert.equal(data.get('codelab.projects.v1'),'new');
});

test('Newmania toolbox exposes individual motor, PS4 and math blocks without drive macros', () => {
  const profile = getBoardProfile(FAST4WD_BOARD_ID);
  const toolbox = editorToolbox(profile.id, 'advanced', defaultRobotDevices(profile));
  const blocks = toolbox.contents.flatMap(category => category.contents || []);
  for (const type of ['beginner_start','beginner_wait','controls_if','math_number','robot_motor_spin',
    'robot_motor_power','robot_ps4_button','robot_ps4_axis','robot_ps4_event','fast4wd_connected']) {
    assert.ok(blocks.some(item => item.type === type), type);
  }
  assert.equal(blocks.filter(item => item.type === 'robot_ps4_event').length, 2);
  assert.ok(!blocks.some(item => item.type === 'fast4wd_drive'));
  assert.ok(!blocks.some(item => ['robot_drive_direction','robot_mecanum','robot_drive_for_time','robot_drive_stop'].includes(item.type)));
  assert.ok(toolbox.contents.some(category => category.custom === 'VARIABLE'));
  assert.ok(toolbox.contents.some(category => category.name === 'Motor'));
});

test('connected nested control blocks regenerate and survive serialization', () => {
  const w = new Blockly.Workspace();
  const start=w.newBlock('beginner_start'), repeat=w.newBlock('controls_repeat_ext'), number=w.newBlock('math_number');
  number.setFieldValue(5,'NUM'); repeat.getInput('TIMES').connection.connect(number.outputConnection);
  start.getInput('DO').connection.connect(repeat.previousConnection);
  const condition=w.newBlock('controls_if'); condition.loadExtraState({hasElse:true});
  repeat.getInput('DO').connection.connect(condition.previousConnection);
  const bool=w.newBlock('logic_boolean'); condition.getInput('IF0').connection.connect(bool.outputConnection);
  const wait=w.newBlock('beginner_wait'); condition.getInput('DO0').connection.connect(wait.previousConnection);
  const out=generateArduino(w); assert.deepEqual(out.warnings, []); assert.match(out.code,/if \(true\)/); assert.match(out.code,/delay\(1000\)/);
  wait.unplug(); const disconnected=generateArduino(w); assert.doesNotMatch(disconnected.code.slice(disconnected.code.indexOf('if (true)'), disconnected.code.indexOf('void loop()')),/delay\(1000\)/);
  condition.getInput('ELSE').connection.connect(wait.previousConnection);
  const reconnected=generateArduino(w); assert.match(reconnected.code,/else \{\s*delay\(1000\)/);
  const saved=Blockly.serialization.workspaces.save(w); const restored=new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved,restored); assert.deepEqual(Blockly.serialization.workspaces.save(restored),saved);
  assert.equal(generateArduino(restored).code,reconnected.code); w.dispose();restored.dispose();
});


test('new projects use the tested board while imports retain their board ID', () => {
  const app = readFileSync('src/App.jsx','utf8');
  assert.match(app, /boardId = FAST4WD_BOARD_ID/);
  assert.match(app, /defaultRobotDevices\(getBoardProfile\(FAST4WD_BOARD_ID\)\)/);
  assert.match(app, /<ProfileToolbar[\s\S]*?boardId=\{boardId\}/);
  assert.match(app, /onBoard=\{\(\) => \{\}\}/);
  assert.match(app, /projectBoardId\(content\)/);
  assert.match(app, /boardId === FAST4WD_BOARD_ID \? generatedCode.warnings/);
  const workspace = new Blockly.Workspace();
  const generated = generateArduino(workspace, FAST4WD_BOARD_ID, defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID)));
  assert.deepEqual(generated.warnings, []);
  assert.match(generated.code, /robot4wd\.begin/);
  workspace.dispose();
  assert.equal(FAST4WD_BOARD_ID, 'newmania-fast100-4wd');
  assert.equal(getBoardProfile(FAST4WD_BOARD_ID).build.fqbn,
    'esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=disabled,USBMode=hwcdc,CDCOnBoot=cdc');
});

test('Newmania initializes eight groups without stored devices and exposes M1–M4', () => {
  const toolbox = editorToolbox(FAST4WD_BOARD_ID);
  assert.deepEqual(toolbox.contents.map(c => c.name), ['Bắt đầu & Điều khiển','Logic','Toán học','Biến','Hiển thị / Serial','Motor','Tay cầm PS4']);
  assert.deepEqual(toolbox.contents[5].contents.filter(b => b.type === 'robot_motor_spin').map(b => b.fields.MOTOR), ['motor-1','motor-2','motor-3','motor-4']);
  assert.ok(!JSON.stringify(toolbox).includes('beginner_ps4_sim'));
});

test('confirmed copy preserves legacy workspace, variables and source board; reports unsupported blocks', () => {
  const w = new Blockly.Workspace();
  w.getVariableMap().createVariable('speed');
  const oldBlock = w.newBlock('beginner_ps4_sim');
  const original = { id:'old', name:'Generic', boardId:'generic-esp32-s3', workspace:JSON.parse(JSON.stringify(Blockly.serialization.workspaces.save(w))) };
  const before = structuredClone(original);
  assert.equal(projectRobotDevices(original), undefined);
  const copy = newmaniaCopy(original, 'copy');
  assert.deepEqual(original, before);
  assert.deepEqual(copy.workspace, original.workspace);
  assert.equal(copy.boardId, FAST4WD_BOARD_ID);
  const issues = newmaniaCompatibility(w, projectRobotDevices(copy));
  assert.ok(issues.some(issue => issue.id === oldBlock.id && issue.type === 'beginner_ps4_sim'));
  const reopened = JSON.parse(JSON.stringify(copy));
  assert.equal(reopened.boardId, FAST4WD_BOARD_ID);
  assert.deepEqual(reopened.workspace, before.workspace);
  w.dispose();
});

test('real PS4 event runs M1, waits and stops after project save/reopen', () => {
  const w = new Blockly.Workspace();
  w.getVariableMap().createVariable('speed');
  const event = w.newBlock('robot_ps4_event');
  const spin = w.newBlock('robot_motor_spin'); spin.setFieldValue('motor-1','MOTOR');
  const power = w.newBlock('math_number'); power.setFieldValue(20,'NUM');
  spin.getInput('POWER').connection.connect(power.outputConnection);
  const wait = w.newBlock('beginner_wait');
  const stop = w.newBlock('robot_motor_stop'); stop.setFieldValue('motor-1','MOTOR');
  event.getInput('DO').connection.connect(spin.previousConnection);
  spin.nextConnection.connect(wait.previousConnection); wait.nextConnection.connect(stop.previousConnection);
  const project = { boardId:FAST4WD_BOARD_ID, workspace:Blockly.serialization.workspaces.save(w) };
  const output = generateArduino(w, project.boardId, projectRobotDevices(project));
  assert.deepEqual(output.warnings, []);
  assert.match(output.code, /CodeLabFast4wd.h/);
  assert.match(output.code, /robot4wd.begin/);
  const reopened = JSON.parse(JSON.stringify(project));
  const restored = new Blockly.Workspace(); Blockly.serialization.workspaces.load(reopened.workspace, restored);
  assert.deepEqual(Blockly.serialization.workspaces.save(restored), project.workspace);
  assert.equal(generateArduino(restored, reopened.boardId, projectRobotDevices(reopened)).code, output.code);
  assert.deepEqual(newmaniaCompatibility(w, projectRobotDevices(project)), []);
  w.dispose(); restored.dispose();
});
