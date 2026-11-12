import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly';
import { TYPES } from '../src/blocks/newmania.js';
import { generateArduino } from '../src/generators/arduino.js';
import { FAST4WD_BOARD_ID } from '../src/boards/profiles.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const load = state => { const w = new Blockly.Workspace(); Blockly.serialization.workspaces.load(state, w); return w; };
const text = block => block.toString().replaceAll('\u00a0', ' ');
const json = value => JSON.parse(JSON.stringify(value));

test('PS4 labels, examples and Boolean/Number shapes are student friendly', () => {
  const w = new Blockly.Workspace();
  const connect = w.newBlock(TYPES.connect), button = w.newBlock(TYPES.button);
  const axis = w.newBlock('robot_ps4_axis'), connected = w.newBlock('fast4wd_connected');
  assert.equal(text(connect), 'Kết nối tay cầm PS4');
  button.setFieldValue('HELD', 'STATE');
  assert.equal(text(button), 'Nút X Đang giữ ?');
  assert.deepEqual(button.getField('STATE').getOptions(false), [['Vừa nhấn', 'PRESS'], ['Đang giữ', 'HELD'], ['Vừa thả', 'RELEASE']]);
  assert.equal(text(axis), 'Độ nghiêng cần Trái theo Ngang');
  assert.equal(text(connected), 'Tay cầm PS4 đã kết nối?');
  for (const block of [connect, button, axis, connected]) assert.match(block.getTooltip(), /Ví dụ/);
  assert.match(axis.getTooltip(), /-100 đến 100/); assert.match(axis.getTooltip(), /ở giữa là 0/);
  assert.deepEqual(button.outputConnection.getCheck(), ['Boolean']);
  assert.deepEqual(connected.outputConnection.getCheck(), ['Boolean']);
  assert.deepEqual(axis.outputConnection.getCheck(), ['Number']);
  w.dispose();
});

test('all four historical AXIS values restore two visible dropdowns with identical saved data', () => {
  for (const [value, stick, direction] of [['0','Trái','Ngang'],['1','Trái','Dọc'],['2','Phải','Ngang'],['3','Phải','Dọc']]) {
    const state = {blocks:{languageVersion:0,blocks:[{type:'robot_ps4_axis',id:'old-axis',x:10,y:20,fields:{AXIS:value}}]}};
    const w = load(state), axis = w.getBlockById('old-axis');
    assert.equal(axis.getField('STICK').getText(), stick);
    assert.equal(axis.getField('AXIS').getText(), direction);
    assert.deepEqual(axis.getField('AXIS').getOptions(false).map(([label]) => label), ['Ngang','Dọc']);
    assert.deepEqual(json(Blockly.serialization.workspaces.save(w)), state);
    const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(w));
    assert.match(xml, new RegExp(`<field name="AXIS">${value}</field>`));
    assert.doesNotMatch(xml, /name="STICK"/);
    const reopened = new Blockly.Workspace(); Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), reopened);
    assert.equal(text(reopened.getBlockById('old-axis')), text(axis));
    w.dispose(); reopened.dispose();
  }
});

test('stick and direction changes retain the original axis mapping and one-step undo/redo', async () => {
  const w = new Blockly.Workspace(), axis = w.newBlock('robot_ps4_axis');
  await settle(); w.clearUndo();
  const changes = [];
  w.addChangeListener(event => { if(event.type === Blockly.Events.BLOCK_CHANGE && event.element === 'field') changes.push(event); });
  axis.setFieldValue('RIGHT', 'STICK'); await settle();
  assert.equal(axis.getFieldValue('AXIS'), '2');
  assert.equal(text(axis), 'Độ nghiêng cần Phải theo Ngang');
  assert.deepEqual(changes.map(e => e.name), ['AXIS']);
  w.undo(false); await settle(); assert.equal(text(axis), 'Độ nghiêng cần Trái theo Ngang');
  w.undo(true); await settle(); assert.equal(text(axis), 'Độ nghiêng cần Phải theo Ngang');
  axis.setFieldValue('3', 'AXIS'); await settle();
  assert.equal(text(axis), 'Độ nghiêng cần Phải theo Dọc');
  axis.setFieldValue('LEFT', 'STICK'); await settle();
  assert.equal(axis.getFieldValue('AXIS'), '1');
  assert.equal(text(axis), 'Độ nghiêng cần Trái theo Dọc');
  assert.deepEqual(json(Blockly.serialization.blocks.save(axis).fields), {AXIS:'1'});
  w.dispose();
});

test('existing Newmania project data reopens unchanged and matches current runtime goldens', () => {
  for (const name of ['hold_m1','counter_x','mecanum']) {
    const project = JSON.parse(readFileSync(`examples/newmania/${name}/${name}.codelab.json`, 'utf8')).project;
    const before = JSON.stringify(project), w = load(project.workspace);
    const result = generateArduino(w, project.boardId, project.deviceConfigs?.[project.boardId]);
    assert.equal(project.boardId, FAST4WD_BOARD_ID);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.code, readFileSync(`examples/newmania/${name}/${name}.ino`, 'utf8').replaceAll('\r\n','\n'));
    assert.deepEqual(json(Blockly.serialization.workspaces.save(w)), project.workspace);
    assert.equal(JSON.stringify(project), before); w.dispose();
  }
});

test('legacy and current projects generate identical C++ to the former single-dropdown UI for every axis', () => {
  const current = Blockly.Blocks.robot_ps4_axis.init;
  for (const path of ['examples/beginner/lesson_robot_mecanum/lesson_robot_mecanum.codelab.json', 'examples/newmania/mecanum/mecanum.codelab.json']) {
    const project = JSON.parse(readFileSync(path, 'utf8')).project;
    for (const value of ['0','1','2','3']) {
      let oldWorkspace;
      try {
        Blockly.Blocks.robot_ps4_axis.init = function () {
          this.appendDummyInput().appendField('trục PS4').appendField(new Blockly.FieldDropdown([
            ['trái X','0'],['trái Y','1'],['phải X','2'],['phải Y','3'],
          ]), 'AXIS').appendField('(%)');
          this.setOutput(true, 'Number');
        };
        oldWorkspace = load(project.workspace);
        for (const axis of oldWorkspace.getBlocksByType('robot_ps4_axis', false)) axis.setFieldValue(value, 'AXIS');
        const saved = json(Blockly.serialization.workspaces.save(oldWorkspace));
        const expected = generateArduino(oldWorkspace, project.boardId, project.deviceConfigs?.[project.boardId]);
        assert.deepEqual(expected.warnings, []);
        Blockly.Blocks.robot_ps4_axis.init = current;
        const reopened = load(saved);
        const actual = generateArduino(reopened, project.boardId, project.deviceConfigs?.[project.boardId]);
        assert.deepEqual(actual, expected);
        assert.deepEqual(json(Blockly.serialization.workspaces.save(reopened)), saved);
        assert.match(actual.code, project.programModel
          ? new RegExp(`newmania.axis\\(Axis::${['LeftX','LeftY','RightX','RightY'][Number(value)]}\\)`)
          : new RegExp(`robot4wd.axis\\(${value}\\)`));
        reopened.dispose();
      } finally { Blockly.Blocks.robot_ps4_axis.init = current; oldWorkspace?.dispose(); }
    }
  }
});
