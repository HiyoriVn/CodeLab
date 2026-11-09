import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/beginner.js';
import '../src/blocks/fast4wd.js';
import { robotDeviceToolbox } from '../src/blocks/robot-devices.js';
import { BOARD_PROFILES, FAST4WD_BOARD_ID, getBoardProfile, validatePin } from '../src/boards/profiles.js';
import { defaultRobotDevices, robotDeviceWarnings, validateProjectDeviceConfigs } from '../src/boards/robot-devices.js';
import { generateArduino } from '../src/generators/arduino.js';

test('4WD lesson generates real runtime calls, preserves its workspace, and rejects other profiles', () => {
  const { project } = JSON.parse(readFileSync('examples/beginner/lesson_ps4_4wd/lesson_ps4_4wd.codelab.json', 'utf8'));
  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(project.workspace, workspace);
  try {
    const out = generateArduino(workspace, project.boardId);
    assert.deepEqual(out.warnings, []);
    assert.match(out.code, /#include <CodeLabFast4wd.h>\s+static codelab::fast4wd::Robot robot4wd\(100\)/);
    assert.match(out.code, /robot4wd.begin\(true\);/);
    assert.match(out.code, /robot4wd.beginLoop\(\);\s*robot4wd.driveFromPs4\(\);\s*robot4wd.endLoop\(\);/);
    const saved = Blockly.serialization.workspaces.save(workspace);
    for (const board of BOARD_PROFILES.filter(board => board.id !== FAST4WD_BOARD_ID)) {
      const result = generateArduino(workspace, board.id);
      assert.ok(result.warnings.length);
      assert.equal(result.code, '');
      assert.deepEqual(Blockly.serialization.workspaces.save(workspace), saved);
    }
    const profile = getBoardProfile(FAST4WD_BOARD_ID);
    assert.deepEqual(profile.pins.motors, [[35,36],[37,38],[39,40],[41,42]]);
    assert.deepEqual(profile.pins.i2c, {sda:8,scl:9});
    assert.equal(profile.pins.led, 47);
    assert.ok(profile.pins.motors.flat().every(pin => validatePin(profile, pin).length));

    const drive = workspace.getBlockById('fast4wd-drive');
    const conditional = workspace.newBlock('controls_if');
    drive.nextConnection.connect(conditional.previousConnection);
    conditional.getInput('IF0').connection.connect(workspace.newBlock('fast4wd_connected').outputConnection);
    const forward = workspace.newBlock('fast4wd_forward');
    const strafe = workspace.newBlock('fast4wd_strafe');
    const turn = workspace.newBlock('fast4wd_turn');
    strafe.setFieldValue('NEGATIVE', 'DIRECTION');
    conditional.getInput('DO0').connection.connect(forward.previousConnection);
    forward.nextConnection.connect(strafe.previousConnection);
    strafe.nextConnection.connect(turn.previousConnection);
    turn.nextConnection.connect(workspace.newBlock('fast4wd_stop').previousConnection);
    workspace.getBlockById('fast4wd-speed').setFieldValue(25, 'PERCENT');
    const extended = generateArduino(workspace, profile.id);
    assert.deepEqual(extended.warnings, []);
    assert.match(extended.code, /robot4wd\(25\);/);
    assert.match(extended.code, /if \(robot4wd.connected\(\)\) \{\s*robot4wd.move\(1, 0, 0\);\s*robot4wd.move\(0, -1, 0\);\s*robot4wd.move\(0, 0, 1\);\s*robot4wd.stop\(\);/);
    workspace.newBlock('beginner_wait');
    assert.equal(generateArduino(workspace, profile.id).code, '');
  } finally {
    workspace.dispose();
  }
});

test('real 4WD runtime drives the expected MCPWM pins and stops on Share, stop block and stale I2C', () => {
  const dir = resolve('firmware/tests/build-output/fast4wd');
  mkdirSync(join(dir, 'driver'), { recursive: true });
  for (const header of ['Arduino.h', 'Wire.h', 'esp_chip_info.h', 'esp_efuse.h', 'esp_efuse_table.h', 'driver/gpio.h', 'driver/mcpwm.h']) {
    writeFileSync(join(dir, header), '#include "fast4wd-platform.h"\n');
  }
  const binary = join(dir, 'runtime.exe');
  const compiler = process.env.CXX || 'g++';
  const flags = ['-std=c++17', '-Wall', '-Wextra', '-Werror',
    '-I' + dir, '-I' + resolve('tests/fixtures'),
    ...['CodeLabFast4wd', 'CodeLabPs4I2C', 'CodeLabRobot'].map(lib => '-I' + resolve('firmware/libraries', lib, 'src'))];
  execFileSync(compiler, [...flags, resolve('tests/fast4wd-native.cpp'), '-o', binary]);
  execFileSync(binary);
  for (const name of ['lesson_robot_mecanum', 'lesson_robot_motor_events']) {
    const { project } = JSON.parse(readFileSync(`examples/beginner/${name}/${name}.codelab.json`, 'utf8'));
    const workspace = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(project.workspace, workspace);
      const generated = generateArduino(workspace, project.boardId, project.deviceConfigs[project.boardId]);
      assert.deepEqual(generated.warnings, []);
      execFileSync(compiler, [...flags, '-fsyntax-only', '-x', 'c++', '-'], { input: generated.code });
    } finally {
      workspace.dispose();
    }
  }
});

test('device configurations validate board ports, distinct enabled wheels and versions', () => {
  for (const [id, count] of [['newmania-starter-v1', 4], ['steam-mainboard-v2', 6], ['newmania-v1-16m-opi-experimental', 0]]) {
    const profile = getBoardProfile(id);
    const devices = defaultRobotDevices(profile);
    assert.equal(devices.motors.length, count);
    assert.deepEqual(robotDeviceWarnings(devices, profile), []);
    assert.ok(!robotDeviceToolbox(devices, profile).some(group => group.name === 'Tay cầm PS4'));
    if (!count) continue;
    devices.motors[1].port = devices.motors[0].port;
    assert.match(robotDeviceWarnings(devices, profile).join(), /chung một cổng/);
    devices.motors[0].enabled = false;
    assert.match(robotDeviceWarnings(devices, profile).join(), /bốn motor khác nhau đang bật/);
    assert.throws(() => validateProjectDeviceConfigs({ [id]: devices }));
  }
  assert.throws(() => validateProjectDeviceConfigs({ [FAST4WD_BOARD_ID]: { version: 2 } }), /phiên bản/);
});

test('configured lessons round-trip, resolve stable motor IDs and keep waiting outside the safety loop', () => {
  for (const name of ['lesson_robot_mecanum', 'lesson_robot_motor_events']) {
    const file = JSON.parse(readFileSync(`examples/beginner/${name}/${name}.codelab.json`, 'utf8'));
    const { project } = file;
    const devices = project.deviceConfigs[project.boardId];
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(project.workspace, workspace);
    try {
      validateProjectDeviceConfigs(project.deviceConfigs);
      const original = generateArduino(workspace, project.boardId, devices);
      assert.deepEqual(original.warnings, []);
      assert.match(original.code, /void loop\(\) \{\s*robot4wd.beginLoop\(\);\s*codelabRobotBlocks\(\);\s*robot4wd.endLoop\(\);/);
      const saved = Blockly.serialization.workspaces.save(workspace);
      const restored = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(saved, restored);
      assert.deepEqual(generateArduino(restored, project.boardId, JSON.parse(JSON.stringify(devices))), original);
      restored.dispose();
      for (const otherBoard of ['newmania-starter-v1', 'steam-mainboard-v2', 'newmania-v1-16m-opi-experimental']) {
        assert.equal(generateArduino(workspace, otherBoard).code, '');
      }
      assert.ok(generateArduino(workspace, project.boardId).warnings.length);
      if (name === 'lesson_robot_mecanum') {
        assert.match(original.code, /if \(robot4wd.connected\(\)\)[\s\S]*robot4wd.movePercent\(robot4wd.axis\(1\), robot4wd.axis\(2\), robot4wd.axis\(0\)\);\s*} else/);
      } else {
        assert.match(original.code, /buttonEdge\(0, true\)[\s\S]*spinFor\(0, 25, false, 500\);\s*if \(!robot4wd.spinFor\(1, 20, false, 300\) \|\| !robot4wd.waitForMotor\(1\)\) return;/);
        assert.match(original.code, /buttonEdge\(0, false\)[\s\S]*stopMotor\(0\)/);
        devices.motors[0].name = 'Bánh nâng';
        assert.equal(generateArduino(workspace, project.boardId, devices).code, original.code);
        [devices.motors[0].port, devices.motors[2].port] = [3, 1];
        assert.match(generateArduino(workspace, project.boardId, devices).code, /spinFor\(2, 25, false, 500\)/);
        devices.motors[0].enabled = false;
        assert.match(generateArduino(workspace, project.boardId, devices).warnings.join(), /tắt hoặc thiếu/);
      }
    } finally {
      workspace.dispose();
    }
  }
});
