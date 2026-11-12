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
import { v1StudentToolbox } from '../src/blocks/beginner-toolbox.js';
import { generateArduino } from '../src/generators/arduino.js';
import { clearOldProjectsOnce } from '../src/ui/project-storage.js';

test('old projects are removed once and new projects survive subsequent launches', () => {
  const data = new Map([['codelab.projects.v1','old'], ['codelab.workspace.v1','old']]);
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  clearOldProjectsOnce(storage);
  assert.equal(data.has('codelab.projects.v1'), false);
  assert.equal(data.has('codelab.workspace.v1'), false);
  data.set('codelab.projects.v1','new'); clearOldProjectsOnce(storage);
  assert.equal(data.get('codelab.projects.v1'),'new');
});

test('student toolbox hides advanced and robot macros', () => {
  for (const id of ['generic-esp32-s3','newmania-starter-v1','newmania-v1-16m-opi-experimental','newmania-fast100-4wd']) {
    const toolbox = v1StudentToolbox(id);
    const blocks = toolbox.contents.flatMap(category => category.contents || []);
    assert.ok(!blocks.some(item => /^(robot_|fast4wd_|codelab_|beginner_ps4_|beginner_blink)/.test(item.type)));
    assert.ok(blocks.some(item => item.type === 'beginner_start'));
    assert.ok(toolbox.contents.some(category => category.custom === 'VARIABLE'));
  }
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
  assert.match(app, /<ProfileToolbar\s+boardId=\{boardId\}/);
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
