import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/beginner.js';
import '../src/blocks/fast4wd.js';
import '../src/blocks/robot-devices.js';
import { editorToolbox } from '../src/blocks/beginner-toolbox.js';
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
    assert.match(out.code, /robot4wd.beginLoop\(\);\s*codelabSchedulerLoop\(\);\s*robot4wd.endLoop\(\);/);
    assert.match(out.code, /registerScript\(/);
    assert.doesNotMatch(out.code, /codelabRobotBlocks\(\);/);
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
    assert.match(extended.code, /Fast4wdSchedulerGate.h/);
    assert.match(extended.code, /codelabSchedulerLoop\(\)/);
    assert.match(extended.code, /codelabScheduler.registerScript/);
    assert.match(extended.code, /codelabDrive\(1,0,0\)/);
    assert.doesNotMatch(extended.code, /codelabRobotBlocks\(\);/);
    const waiting = workspace.newBlock('beginner_wait');
    assert.ok(generateArduino(workspace, profile.id).warnings.length);
    waiting.dispose();
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

test('generated Blockly event hats use G1 callbacks and timer WAIT continuations', () => {
  const profile = getBoardProfile(FAST4WD_BOARD_ID);
  const devices = defaultRobotDevices(profile);
  const workspace = new Blockly.Workspace();
  const event = (edge, button) => {
    const block = workspace.newBlock('robot_ps4_event');
    block.setFieldValue(edge, 'EDGE');
    block.setFieldValue(String(button), 'BUTTON');
    return block;
  };
  const pressX = event('PRESS', 0);
  const wait = workspace.newBlock('beginner_wait');
  wait.setFieldValue(2, 'SECONDS');
  const stop = workspace.newBlock('robot_motor_stop');
  stop.setFieldValue('motor-1', 'MOTOR');
  pressX.getInput('DO').connection.connect(wait.previousConnection);
  wait.nextConnection.connect(stop.previousConnection);
  const releaseX = event('RELEASE', 0);
  const releaseStop = workspace.newBlock('robot_motor_stop');
  releaseStop.setFieldValue('motor-1', 'MOTOR');
  releaseX.getInput('DO').connection.connect(releaseStop.previousConnection);
  const pressO = event('PRESS', 1);
  const runO = workspace.newBlock('robot_motor_spin');
  runO.setFieldValue('motor-1', 'MOTOR');
  const power = workspace.newBlock('math_number');
  power.setFieldValue(50, 'NUM');
  runO.getInput('POWER').connection.connect(power.outputConnection);
  pressO.getInput('DO').connection.connect(runO.previousConnection);
  const forever = workspace.newBlock('beginner_forever');
  const conditional = workspace.newBlock('controls_if');
  const truth = workspace.newBlock('logic_boolean');
  const repeat = workspace.newBlock('controls_repeat_ext');
  const repeatCount = workspace.newBlock('math_number');
  const nestedWait = workspace.newBlock('beginner_wait');
  repeatCount.setFieldValue(2, 'NUM');
  nestedWait.setFieldValue(0.1, 'SECONDS');
  conditional.getInput('IF0').connection.connect(truth.outputConnection);
  conditional.getInput('DO0').connection.connect(repeat.previousConnection);
  repeat.getInput('TIMES').connection.connect(repeatCount.outputConnection);
  repeat.getInput('DO').connection.connect(nestedWait.previousConnection);
  forever.getInput('DO').connection.connect(conditional.previousConnection);
  try {
    const out = generateArduino(workspace, profile.id, devices);
    assert.deepEqual(out.warnings, []);
    assert.match(out.code, /registerEventScript\([^\n]+Edge::PRESS/);
    assert.match(out.code, /registerEventScript\([^\n]+Edge::RELEASE/);
    assert.match(out.code, /deadlineMs = nowMs \+ 2000UL/);
    assert.match(out.code, /WaitKind::TIMER/);
    assert.match(out.code, /codelabScheduler\.motorWrite\(0, codelabSchedulerPower\(50\), nowMs\)/);
    assert.doesNotMatch(out.code, /delay\(|waitForMotor|codelabRobotBlocks/);
    assert.match(out.code, /codelabScheduler\.buttonEdge\(button, codelab::v2::Edge::PRESS, nowMs\)/);
    assert.match(out.code, /FaultCode::LINK_LOST/);
    assert.match(out.code, /ctx.loopCounters\[0\]/);
    assert.match(out.code, /ctx.pc = \(true\)/);
  } finally {
    workspace.dispose();
  }
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
      assert.match(original.code, /void loop\(\) \{\s*robot4wd.beginLoop\(\);\s*codelabSchedulerLoop\(\);\s*robot4wd.endLoop\(\);/);
      assert.match(original.code, /CodeLabV2Scheduler|Fast4wdSchedulerGate/);
      assert.doesNotMatch(original.code, /robot4wd.waitForMotor|delay\(/);
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
        assert.match(original.code, /ctx.pc = \(robot4wd.connected\(\)\)/);
        assert.match(original.code, /codelabDrivePercent\(robot4wd.axis\(1\),robot4wd.axis\(2\),robot4wd.axis\(0\)\)/);
      } else {
        assert.match(original.code, /registerEventScript\([^\n]+Edge::PRESS/);
        assert.match(original.code, /registerEventScript\([^\n]+Edge::RELEASE/);
        assert.match(original.code, /motorRunFor\(0, codelabSchedulerPower\(25\), 500UL, nowMs\)/);
        assert.match(original.code, /WaitKind::HANDLE/);
        assert.match(original.code, /motorWrite\(0, 0, nowMs\)/);
        devices.motors[0].name = 'Bánh nâng';
        assert.equal(generateArduino(workspace, project.boardId, devices).code, original.code);
        [devices.motors[0].port, devices.motors[2].port] = [3, 1];
        assert.match(generateArduino(workspace, project.boardId, devices).code, /motorRunFor\(2, codelabSchedulerPower\(25\), 500UL, nowMs\)/);
        devices.motors[0].enabled = false;
        assert.match(generateArduino(workspace, project.boardId, devices).warnings.join(), /tắt hoặc thiếu/);
      }
    } finally {
      workspace.dispose();
    }
  }
});

test('fast100 toolbox exposes IF/ELSE, arithmetic, numeric variables, nonblocking message and safe RUN start hat', () => {
  const profile = getBoardProfile(FAST4WD_BOARD_ID);
  const devices = defaultRobotDevices(profile);
  const toolbox = editorToolbox(FAST4WD_BOARD_ID, 'beginner', devices);
  const controlCat = toolbox.contents.find(c => c.name === 'Bắt đầu & Điều khiển');
  assert.ok(controlCat);
  assert.ok(controlCat.contents.some(b => b.type === 'beginner_start'));
  assert.ok(controlCat.contents.some(b => b.type === 'controls_if' && !b.extraState));
  assert.ok(controlCat.contents.some(b => b.type === 'controls_if' && b.extraState?.hasElse === true));
  assert.ok(controlCat.contents.some(b => b.type === 'beginner_message'));

  const logicCat = toolbox.contents.find(c => c.name === 'Logic');
  assert.ok(logicCat);
  assert.ok(logicCat.contents.some(b => b.type === 'math_arithmetic'));
  assert.ok(logicCat.contents.some(b => b.type === 'text'));

  const varCat = toolbox.contents.find(c => c.custom === 'VARIABLE');
  assert.ok(varCat);
  assert.deepEqual(varCat.contents.map(b => b.type), ['variables_set', 'math_change', 'variables_get']);
});

test('nested if/else, arithmetic, numeric variables across Wait, nonblocking message and RUN start hat execute in V2 scheduler', () => {
  const profile = getBoardProfile(FAST4WD_BOARD_ID);
  const devices = defaultRobotDevices(profile);
  const workspace = new Blockly.Workspace();
  try {
    const speedVar = workspace.createVariable('speed', '', 'var_speed');
    const stepVar = workspace.createVariable('steps', '', 'var_steps');

    const num = n => {
      const b = workspace.newBlock('math_number');
      b.setFieldValue(n, 'NUM');
      return b;
    };
    const arith = (op, a, b) => {
      const block = workspace.newBlock('math_arithmetic');
      block.setFieldValue(op, 'OP');
      block.getInput('A').connection.connect(a.outputConnection);
      block.getInput('B').connection.connect(b.outputConnection);
      return block;
    };
    const cmp = (op, a, b) => {
      const block = workspace.newBlock('logic_compare');
      block.setFieldValue(op, 'OP');
      block.getInput('A').connection.connect(a.outputConnection);
      block.getInput('B').connection.connect(b.outputConnection);
      return block;
    };
    const getVar = variable => {
      const b = workspace.newBlock('variables_get');
      b.setFieldValue(variable.getId(), 'VAR');
      return b;
    };
    const setVar = (variable, valBlock) => {
      const b = workspace.newBlock('variables_set');
      b.setFieldValue(variable.getId(), 'VAR');
      b.getInput('VALUE').connection.connect(valBlock.outputConnection);
      return b;
    };
    const changeVar = (variable, deltaBlock) => {
      const b = workspace.newBlock('math_change');
      b.setFieldValue(variable.getId(), 'VAR');
      b.getInput('DELTA').connection.connect(deltaBlock.outputConnection);
      return b;
    };
    const msgText = str => {
      const m = workspace.newBlock('beginner_message');
      const t = workspace.newBlock('text');
      t.setFieldValue(str, 'TEXT');
      m.getInput('VALUE').connection.connect(t.outputConnection);
      return m;
    };
    const msgVal = valBlock => {
      const m = workspace.newBlock('beginner_message');
      m.getInput('VALUE').connection.connect(valBlock.outputConnection);
      return m;
    };

    // 1. Safe RUN start hat (`beginner_start`):
    // Sets speed = (10 + 20) * 2 - 10 = 50, logs "boot", waits 0.2s, changes speed by 20 / 2 = 10 -> 60, logs speed (60)
    const startHat = workspace.newBlock('beginner_start');
    const initSpeed = setVar(speedVar, arith('MINUS', arith('MULTIPLY', arith('ADD', num(10), num(20)), num(2)), num(10)));
    const bootMsg = msgText('boot');
    const startWait = workspace.newBlock('beginner_wait');
    startWait.setFieldValue(0.2, 'SECONDS');
    const addSpeed = changeVar(speedVar, arith('DIVIDE', num(20), num(2)));
    const logSpeed = msgVal(getVar(speedVar));

    startHat.getInput('DO').connection.connect(initSpeed.previousConnection);
    initSpeed.nextConnection.connect(bootMsg.previousConnection);
    bootMsg.nextConnection.connect(startWait.previousConnection);
    startWait.nextConnection.connect(addSpeed.previousConnection);
    addSpeed.nextConnection.connect(logSpeed.previousConnection);

    // 2. PS4 Event hat (`robot_ps4_event` on CROSS press):
    // Nested IF/ELSE with arithmetic condition:
    // if (speed / 2 > 25) {
    //   if (steps == 0) { steps += 1; spin motor-1 at speed; } else { steps += 10; spin motor-1 at speed / 2; }
    // } else { stop motor-1; }
    const eventHat = workspace.newBlock('robot_ps4_event');
    eventHat.setFieldValue('PRESS', 'EDGE');
    eventHat.setFieldValue('0', 'BUTTON');

    const outerIf = workspace.newBlock('controls_if');
    outerIf.loadExtraState({ hasElse: true });
    outerIf.getInput('IF0').connection.connect(
      cmp('GT', arith('DIVIDE', getVar(speedVar), num(2)), num(25)).outputConnection
    );

    const innerIf = workspace.newBlock('controls_if');
    innerIf.loadExtraState({ hasElse: true });
    innerIf.getInput('IF0').connection.connect(
      cmp('EQ', getVar(stepVar), num(0)).outputConnection
    );

    const incStep1 = changeVar(stepVar, num(1));
    const spinFull = workspace.newBlock('robot_motor_spin');
    spinFull.setFieldValue('motor-1', 'MOTOR');
    spinFull.getInput('POWER').connection.connect(getVar(speedVar).outputConnection);
    incStep1.nextConnection.connect(spinFull.previousConnection);
    innerIf.getInput('DO0').connection.connect(incStep1.previousConnection);

    const incStep10 = changeVar(stepVar, num(10));
    const spinHalf = workspace.newBlock('robot_motor_spin');
    spinHalf.setFieldValue('motor-1', 'MOTOR');
    spinHalf.getInput('POWER').connection.connect(arith('DIVIDE', getVar(speedVar), num(2)).outputConnection);
    incStep10.nextConnection.connect(spinHalf.previousConnection);
    innerIf.getInput('ELSE').connection.connect(incStep10.previousConnection);

    outerIf.getInput('DO0').connection.connect(innerIf.previousConnection);

    const elseStop = workspace.newBlock('robot_motor_stop');
    elseStop.setFieldValue('motor-1', 'MOTOR');
    outerIf.getInput('ELSE').connection.connect(elseStop.previousConnection);

    eventHat.getInput('DO').connection.connect(outerIf.previousConnection);

    const out = generateArduino(workspace, profile.id, devices);
    assert.deepEqual(out.warnings, []);
    assert.doesNotMatch(out.code, /Serial\.println\(/);
    assert.doesNotMatch(out.code, /delay\(/);
    assert.match(out.code, /double speed = 0;/);
    assert.match(out.code, /double steps = 0;/);
    assert.match(out.code, /codelabResetRunState\(ctx\.runGeneration\);/);
    assert.match(out.code, /codelabLogMessage\("boot"\);/);
    assert.match(out.code, /codelabLogNumber\(speed\);/);

    // Compile and run the generated sketch natively against the mock 4WD platform to verify runtime semantics
    const dir = resolve('firmware/tests/build-output/fast4wd');
    mkdirSync(join(dir, 'driver'), { recursive: true });
    for (const header of ['Arduino.h', 'Wire.h', 'esp_chip_info.h', 'esp_efuse.h', 'esp_efuse_table.h', 'driver/gpio.h', 'driver/mcpwm.h']) {
      writeFileSync(join(dir, header), '#include "fast4wd-platform.h"\n');
    }
    const harness = `${out.code}
#include <cassert>
#include <cstring>

static uint8_t nextSeq = 0;
static void sendFrame(uint32_t nowMs, uint32_t buttons = 0, bool connected = true) {
  clockMs = nowMs;
  auto& frame = Wire.report;
  frame.connected = connected;
  frame.sequence = (uint8_t)((++nextSeq) & 127U);
  frame.buttons = buttons;
  loop();
}

int main() {
  Wire.report = {};
  clockMs = 2000;
  setup();
  // During setup() and before PS4 ARM, startHat must NOT have executed:
  assert(codelabScheduler.state() == codelab::v2::LifecycleState::READY);
  assert(speed == 0);
  assert(steps == 0);
  assert(codelabLogCount == 0);

  // Frame 1 (2310): baselineSeen_; Frame 2 (2330): first accepted neutral frame (links Ps4ControlMapping);
  // Frame 3 (2350): OPTIONS rising edge clears startup link fault; Frame 4 (2370): armAfterClear_ arms RobotController;
  // Frame 5 (2390): codelabSchedulerLoop sees controllerArmed() and enters RUN, executing step 1 of startHat!
  sendFrame(2310);
  sendFrame(2330);
  sendFrame(2350, 1U << 9);
  sendFrame(2370);
  sendFrame(2390);
  assert(codelabScheduler.state() == codelab::v2::LifecycleState::RUN);
  assert(speed == 50);

  // Next tick runs step 2 of startHat (logs "boot")
  char msg[64] = {};
  sendFrame(2410);
  assert(codelabPopLogMessage(msg, sizeof(msg)));
  assert(std::strcmp(msg, "boot") == 0);
  assert(!codelabPopLogMessage(msg, sizeof(msg)));

  // Next tick runs step 3 of startHat (200ms timer WAIT starting at 2430 -> deadline 2630)
  sendFrame(2430);
  // Before 200ms elapses (at t=2550ms), speed is still 50 across ticks
  sendFrame(2550);
  assert(speed == 50);

  // At t=2640ms, timer WAIT finishes: speed += 10 -> 60; next tick logs "60"
  sendFrame(2640);
  assert(speed == 60);
  sendFrame(2660);
  assert(codelabPopLogMessage(msg, sizeof(msg)));
  assert(std::strcmp(msg, "60") == 0);

  // Press CROSS (bit 0): outer condition (speed / 2 > 25 => 30 > 25) is true, inner (steps == 0) is true -> steps = 1, motor 0 runs at 60%
  sendFrame(2680, 1U << 0);
  sendFrame(2700, 1U << 0);
  sendFrame(2720, 1U << 0);
  sendFrame(2740, 1U << 0);
  sendFrame(2760, 0);
  assert(steps == 1);

  // Press CROSS again: inner (steps == 0) is false -> else branch runs: steps += 10 -> 11, motor 0 runs at 30%
  sendFrame(2780, 1U << 0);
  sendFrame(2800, 1U << 0);
  sendFrame(2820, 1U << 0);
  sendFrame(2840, 1U << 0);
  sendFrame(2860, 0);
  assert(steps == 11);

  // Verify bounded logging drops after CODELAB_LOG_CAPACITY (8) without blocking
  for (size_t i = 0; i < 10; ++i) codelabLogMessage("msg");
  assert(codelabLogCount == CODELAB_LOG_CAPACITY);
  assert(codelabLogDrops == 2);

  // Stop via SHARE (bit 8) -> returns to READY; then re-arm with OPTIONS (bit 9) -> new RUN resets variables and log queue!
  sendFrame(2880, 1U << 8);
  assert(codelabScheduler.state() == codelab::v2::LifecycleState::READY);
  sendFrame(2900, 0);
  sendFrame(2920, 1U << 9);
  sendFrame(2940, 0);
  assert(codelabScheduler.state() == codelab::v2::LifecycleState::RUN);
  // On the new RUN, steps was reset to 0 and startHat ran its first statement (setting speed = 50)
  assert(steps == 0);
  assert(speed == 50);
  assert(codelabLogDrops == 0);
  sendFrame(2960, 0);
  assert(codelabPopLogMessage(msg, sizeof(msg)));
  assert(std::strcmp(msg, "boot") == 0);
  return 0;
}
`;
    const harnessCpp = join(dir, 'basic_blocks_harness.cpp');
    const harnessExe = join(dir, 'basic_blocks_harness.exe');
    writeFileSync(harnessCpp, harness);
    const compiler = process.env.CXX || 'g++';
    const flags = ['-std=c++17', '-Wall', '-Wextra', '-Werror',
      '-I' + dir, '-I' + resolve('tests/fixtures'),
      ...['CodeLabFast4wd', 'CodeLabPs4I2C', 'CodeLabRobot'].map(lib => '-I' + resolve('firmware/libraries', lib, 'src'))];
    execFileSync(compiler, [...flags, harnessCpp, resolve('firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.cpp'), '-o', harnessExe]);
    execFileSync(harnessExe);
  } finally {
    workspace.dispose();
  }
});
