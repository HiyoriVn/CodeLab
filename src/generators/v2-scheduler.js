const EDGE_BUTTONS = { CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L1: 4, R1: 5,
  L2: 6, R2: 7, SHARE: 8, OPTIONS: 9, L3: 10, R3: 11, PS: 12,
  UP: 13, DOWN: 14, LEFT: 15, RIGHT: 16 };
const SETUP_BLOCKS = new Set(['fast4wd_init', 'fast4wd_connect', 'fast4wd_speed', 'fast4wd_led']);

const stableUid = id => {
  let hash = 2166136261;
  for (const ch of id) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return (hash >>> 0) || 1;
};

function motorPort(block, gen) {
  const motor = gen.fast4wd_.devices?.motors.find(item => item.id === block.getFieldValue('MOTOR'));
  return motor ? motor.port - 1 : -1;
}

function hasRuntimeStatements(hat) {
  for (let b = hat.getInputTargetBlock('DO'); b; b = b.getNextBlock()) {
    if (!SETUP_BLOCKS.has(b.type)) return true;
  }
  return false;
}

function resolveEdgeButton(raw) {
  if (/^\d+$/.test(String(raw))) return Number(raw);
  return EDGE_BUTTONS[raw] ?? 0;
}

function driveDirectionArgs(dir, speed) {
  switch (dir) {
    case 'BACKWARD': return `-(${speed}),0,0`;
    case 'STRAFE_LEFT': return `0,${speed},0`;
    case 'STRAFE_RIGHT': return `0,-(${speed}),0`;
    case 'TURN_LEFT': return `0,0,${speed}`;
    case 'TURN_RIGHT': return `0,0,-(${speed})`;
    default: return `${speed},0,0`;
  }
}

function compileHat(block, gen) {
  const cases = [];
  let nextPc = 1;
  const endPc = 0xffff;
  const add = body => { const pc = nextPc++; cases.push({ pc, body }); return pc; };
  const value = (b, input, fallback = '0') => gen.valueToCode(b, input, 0) || fallback;
  const substack = (b, input) => b.getInputTargetBlock(input);
  const chain = (first, terminal = endPc, depth = 0) => {
    const blocks = [];
    for (let b = first; b; b = b.getNextBlock()) {
      if (!SETUP_BLOCKS.has(b.type)) blocks.push(b);
    }
    let continuation = terminal;
    for (let i = blocks.length - 1; i >= 0; --i) continuation = statement(blocks[i], continuation, depth);
    return continuation;
  };
  const statement = (b, continuation, depth) => {
    if (b.type === 'beginner_wait') {
      const ms = Math.max(0, Math.round(Number(b.getFieldValue('SECONDS')) * 1000));
      return add(`ctx.pc = ${continuation}; ctx.deadlineMs = nowMs + ${ms}UL; ctx.waitKind = codelab::v2::WaitKind::TIMER; return codelab::v2::StepResult::WAIT;`);
    }
    if (b.type === 'controls_if') {
      let elseEntry = b.getInput('ELSE') ? chain(substack(b, 'ELSE'), continuation, depth) : continuation;
      const branches = [];
      for (let i = 0; b.getInput('IF' + i); ++i) branches.push(i);
      for (let i = branches.length - 1; i >= 0; --i) {
        const n = branches[i], body = chain(substack(b, 'DO' + n), continuation, depth);
        const condition = value(b, 'IF' + n, 'false');
        elseEntry = add(`ctx.pc = (${condition}) ? ${body} : ${elseEntry}; return codelab::v2::StepResult::YIELD;`);
      }
      return elseEntry;
    }
    if (b.type === 'controls_repeat_ext') {
      if (depth >= 4) throw new Error('G1_INLINE_LOOP_LIMIT');
      const slot = depth;
      const check = add('');
      const body = chain(substack(b, 'DO'), check, depth + 1);
      const count = value(b, 'TIMES', '0');
      cases.find(item => item.pc === check).body =
        `if (!ctx.loopCounters[${slot}]) { ctx.loopCounters[${slot}] = 1; ctx.frameData[${slot * 2}] = codelabSchedulerRepeatCount(${count}); ctx.frameData[${slot * 2 + 1}] = 0; } ` +
        `if (ctx.frameData[${slot * 2 + 1}] >= ctx.frameData[${slot * 2}]) { ctx.loopCounters[${slot}] = 0; ctx.pc = ${continuation}; } ` +
        `else { ++ctx.frameData[${slot * 2 + 1}]; ctx.pc = ${body}; } return codelab::v2::StepResult::YIELD;`;
      return check;
    }

    let action;
    switch (b.type) {
      case 'robot_motor_spin': {
        const port = motorPort(b, gen), power = value(b, 'POWER');
        const sign = b.getFieldValue('DIRECTION') === 'REVERSE' ? '-' : '';
        action = `codelabScheduler.motorWrite(${port}, ${sign}codelabSchedulerPower(${power}), nowMs);`;
        break;
      }
      case 'robot_motor_power': {
        const port = motorPort(b, gen), power = value(b, 'POWER');
        action = `codelabScheduler.motorWrite(${port}, codelabSchedulerPower(${power}), nowMs);`;
        break;
      }
      case 'robot_motor_for': {
        const port = motorPort(b, gen), power = value(b, 'POWER');
        const sign = b.getFieldValue('DIRECTION') === 'REVERSE' ? '-' : '';
        const duration = Number(b.getFieldValue('MS')) || 1;
        const start = `codelabScheduler.motorRunFor(${port}, ${sign}codelabSchedulerPower(${power}), ${duration}UL, nowMs)`;
        action = b.getFieldValue('WAIT') === 'YES'
          ? `const uint32_t handle = ${start}; if (!handle) return codelab::v2::StepResult::YIELD; ctx.handleId = handle; ctx.pc = ${continuation}; ctx.waitKind = codelab::v2::WaitKind::HANDLE; return codelab::v2::StepResult::WAIT;`
          : `${start};`;
        break;
      }
      case 'robot_motor_stop': action = `codelabScheduler.motorWrite(${motorPort(b, gen)}, 0, nowMs);`; break;
      case 'robot_motor_stop_all': action = 'codelabStopAllMotors(nowMs);'; break;
      case 'robot_motor_release': action = `robot4wd.releaseMotor(${motorPort(b, gen)});`; break;
      case 'fast4wd_drive': action = 'codelabDriveFromPs4();'; break;
      case 'fast4wd_stop': action = 'codelabScheduler.stop(nowMs); return codelab::v2::StepResult::DONE;'; break;
      case 'fast4wd_forward': case 'fast4wd_strafe': case 'fast4wd_turn': {
        const sign = b.getFieldValue('DIRECTION') === 'NEGATIVE' ? -1 : 1;
        const val = b.type === 'fast4wd_forward' ? `${sign},0,0` : b.type === 'fast4wd_strafe' ? `0,${sign},0` : `0,0,${sign}`;
        action = `codelabDrive(${val});`;
        break;
      }
      case 'robot_mecanum': action = `codelabDrivePercent(${['FORWARD','LEFT','TURN'].map(n => value(b,n)).join(',')});`; break;
      case 'robot_drive_direction': {
        const args = driveDirectionArgs(b.getFieldValue('DIRECTION'), value(b, 'SPEED'));
        action = `codelabDrivePercent(${args});`;
        break;
      }
      case 'robot_drive_stop': action = 'codelabDriveStop();'; break;
      case 'robot_drive_for_time': {
        const args = driveDirectionArgs(b.getFieldValue('DIRECTION'), value(b, 'SPEED'));
        const ms = Math.max(0, Math.round(Number(b.getFieldValue('SECONDS')) * 1000));
        action = b.getFieldValue('WAIT') === 'YES'
          ? `codelabDriveForTime(${args}, ${ms}UL, nowMs); ctx.pc = ${continuation}; ctx.deadlineMs = nowMs + ${ms}UL; ctx.waitKind = codelab::v2::WaitKind::TIMER; return codelab::v2::StepResult::WAIT;`
          : `codelabDriveForTime(${args}, ${ms}UL, nowMs);`;
        break;
      }
      case 'variables_set': {
        const id = b.getFieldValue('VAR');
        if (gen.invalidVariableIds_.has(id) || gen.variableTypes_.get(id) !== 'number') throw new Error('G1_INVALID_VARIABLE:' + id);
        action = `${gen.getVariableName(id)} = ${value(b, 'VALUE', '0')};`;
        break;
      }
      case 'math_change': {
        const id = b.getFieldValue('VAR');
        if (gen.invalidVariableIds_.has(id) || gen.variableTypes_.get(id) !== 'number') throw new Error('G1_INVALID_VARIABLE:' + id);
        action = `${gen.getVariableName(id)} += ${value(b, 'DELTA', '0')};`;
        break;
      }
      case 'beginner_message': {
        const msgVal = value(b, 'VALUE', '"Hello!"');
        action = b.getInputTargetBlock('VALUE')?.type === 'text' ? `codelabLogMessage(${msgVal});` : `codelabLogNumber(${msgVal});`;
        break;
      }
      case 'controls_flow_statements': throw new Error('G1_FLOW_CONTROL_UNSUPPORTED');
      default: throw new Error('G1_UNSUPPORTED_BLOCK:' + b.type);
    }
    const terminal = action.includes('return codelab::v2::StepResult::DONE') || action.includes('return codelab::v2::StepResult::WAIT');
    const pc = add(terminal ? action : `${action} ctx.pc = ${continuation}; return codelab::v2::StepResult::YIELD;`);
    return pc;
  };

  let entry;
  if (block.type === 'beginner_forever') {
    entry = add('');
    const bodyEntry = chain(substack(block, 'DO'), entry);
    cases.find(item => item.pc === entry).body = `ctx.pc = ${bodyEntry}; return codelab::v2::StepResult::YIELD;`;
  } else entry = chain(substack(block, 'DO'));
  const uid = stableUid(block.id);
  const fn = `codelabScript_${uid}`;
  const arms = block.type === 'robot_ps4_event'
    ? `codelabSchedulerRegistered = codelabSchedulerRegistered && codelabScheduler.registerEventScript(${uid}UL, ${fn}, ${resolveEdgeButton(block.getFieldValue('BUTTON'))}, codelab::v2::Edge::${block.getFieldValue('EDGE') === 'RELEASE' ? 'RELEASE' : 'PRESS'});`
    : `codelabSchedulerRegistered = codelabSchedulerRegistered && codelabScheduler.registerScript(${uid}UL, ${fn});`;
  const casesText = cases.map(({ pc, body }) => `    case ${pc}: { ${body} }`).join('\n');
  return {
    fn,
    definition: `static codelab::v2::StepResult ${fn}(codelab::v2::ScriptContext& ctx, uint32_t nowMs) {\n` +
      `  codelabResetRunState(ctx.runGeneration);\n` +
      `  if (!codelabScheduler.accountOperations(ctx)) { codelabScheduler.fault(codelab::v2::FaultCode::INLINE_LIMIT, nowMs); return codelab::v2::StepResult::DONE; }\n` +
      `  if (ctx.pc == 0) ctx.pc = ${entry};\n` +
      `  switch (ctx.pc) {\n${casesText}\n` +
      `    default: return codelab::v2::StepResult::DONE;\n  }\n}`,
    registration: arms,
  };
}

export function generateV2Scheduler(workspace, gen) {
  const top = workspace.getTopBlocks(true).filter(block => block.isEnabled() && !block.getInheritedDisabled());
  const hats = top.filter(block =>
    block.type === 'robot_ps4_event' ||
    block.type === 'beginner_forever' ||
    (block.type === 'beginner_start' && hasRuntimeStatements(block))
  );
  if (!hats.length) return { definitions: '', setup: '', loop: '' };
  if (hats.length > 16) throw new Error('V2_SCRIPT_LIMIT: tối đa 16 script event/forever.');
  const resetVars = workspace.getAllVariables()
    .map(v => v.getId())
    .filter(id => !gen.invalidVariableIds_.has(id) && gen.variableTypes_.get(id) === 'number')
    .map(id => `${gen.getVariableName(id)} = 0;`)
    .join(' ');
  const scripts = [];
  for (const hat of hats) scripts.push(compileHat(hat, gen));
  return {
    definitions: `#include <Fast4wdSchedulerGate.h>\n` +
      `static codelab::fast4wd::SchedulerGate codelabSchedulerGate(robot4wd);\n` +
      `static codelab::v2::Scheduler codelabScheduler(codelabSchedulerGate);\n` +
      `static bool codelabSchedulerRegistered = true;\n` +
      `static uint8_t codelabDriveMode = 0; static float codelabDriveValues[3] = {};\n` +
      `static bool codelabDriveTimed = false; static uint32_t codelabDriveDeadlineMs = 0;\n` +
      `static uint32_t codelabRunGeneration = 0;\n` +
      `static constexpr size_t CODELAB_LOG_CAPACITY = 8;\n` +
      `static constexpr size_t CODELAB_LOG_MAX_LEN = 128;\n` +
      `static char codelabLogQueue[CODELAB_LOG_CAPACITY][CODELAB_LOG_MAX_LEN] = {};\n` +
      `static uint8_t codelabLogHead = 0, codelabLogTail = 0, codelabLogCount = 0;\n` +
      `static uint32_t codelabLogDrops = 0;\n` +
      `static void codelabResetRunState(uint32_t generation) { if (codelabRunGeneration == generation) return; codelabRunGeneration = generation; ${resetVars ? resetVars + ' ' : ''}codelabDriveMode = 0; codelabDriveTimed = false; codelabDriveDeadlineMs = 0; codelabLogHead = 0; codelabLogTail = 0; codelabLogCount = 0; codelabLogDrops = 0; }\n` +
      `[[maybe_unused]] static bool codelabLogMessage(const char* message) {\n` +
      `  if (!message) return false;\n` +
      `  size_t len = 0;\n` +
      `  while (message[len] != '\\0' && len < CODELAB_LOG_MAX_LEN) ++len;\n` +
      `  if (len >= CODELAB_LOG_MAX_LEN || codelabLogCount >= CODELAB_LOG_CAPACITY) { ++codelabLogDrops; return false; }\n` +
      `  for (size_t i = 0; i < len; ++i) codelabLogQueue[codelabLogTail][i] = message[i];\n` +
      `  codelabLogQueue[codelabLogTail][len] = '\\0';\n` +
      `  codelabLogTail = (uint8_t)((codelabLogTail + 1U) % CODELAB_LOG_CAPACITY);\n` +
      `  ++codelabLogCount;\n` +
      `  return true;\n` +
      `}\n` +
      `[[maybe_unused]] static bool codelabLogNumber(double value) {\n` +
      `  if (!isfinite(value)) { ++codelabLogDrops; return false; }\n` +
      `  char buf[32] = {};\n` +
      `  const int written = snprintf(buf, sizeof(buf), "%.6g", value);\n` +
      `  if (written <= 0 || (size_t)written >= sizeof(buf)) { ++codelabLogDrops; return false; }\n` +
      `  return codelabLogMessage(buf);\n` +
      `}\n` +
      `[[maybe_unused]] static bool codelabPopLogMessage(char* out, size_t size) {\n` +
      `  if (!codelabLogCount || !out || !size) return false;\n` +
      `  const char* src = codelabLogQueue[codelabLogHead];\n` +
      `  size_t i = 0;\n` +
      `  for (; src[i] != '\\0' && i + 1 < size; ++i) out[i] = src[i];\n` +
      `  out[i] = '\\0';\n` +
      `  codelabLogHead = (uint8_t)((codelabLogHead + 1U) % CODELAB_LOG_CAPACITY);\n` +
      `  --codelabLogCount;\n` +
      `  return true;\n` +
      `}\n` +
      `[[maybe_unused]] static void codelabDriveFromPs4() { codelabDriveTimed = false; codelabDriveMode = 1; }\n` +
      `[[maybe_unused]] static void codelabDrive(float forward, float left, float turn) { codelabDriveTimed = false; codelabDriveMode = 2; codelabDriveValues[0] = forward; codelabDriveValues[1] = left; codelabDriveValues[2] = turn; }\n` +
      `[[maybe_unused]] static void codelabDrivePercent(double forward, double left, double turn) { codelabDrive(isfinite(forward) ? (float)(forward / 100.0) : 0.0f, isfinite(left) ? (float)(left / 100.0) : 0.0f, isfinite(turn) ? (float)(turn / 100.0) : 0.0f); }\n` +
      `[[maybe_unused]] static void codelabDriveStop() { codelabDrive(0.0f, 0.0f, 0.0f); }\n` +
      `[[maybe_unused]] static void codelabDriveForTime(double forward, double left, double turn, uint32_t durationMs, uint32_t nowMs) { if (durationMs == 0) { codelabDriveStop(); return; } codelabDrivePercent(forward, left, turn); codelabDriveTimed = true; codelabDriveDeadlineMs = nowMs + durationMs; }\n` +
      `[[maybe_unused]] static void codelabStopAllMotors(uint32_t nowMs) { for (uint8_t port = 0; port < 4; ++port) codelabScheduler.motorWrite(port, 0, nowMs); codelabDriveStop(); }\n` +
      `[[maybe_unused]] static void codelabUpdateTimedDrive(uint32_t nowMs) { if (codelabDriveTimed && (int32_t)(nowMs - codelabDriveDeadlineMs) >= 0) codelabDriveStop(); }\n` +
      `[[maybe_unused]] static void codelabApplyDrive() { if (codelabDriveMode == 1) robot4wd.driveFromPs4(); else if (codelabDriveMode == 2) robot4wd.move(codelabDriveValues[0], codelabDriveValues[1], codelabDriveValues[2]); }\n` +
      `[[maybe_unused]] static uint32_t codelabSchedulerRepeatCount(double n) { return !isfinite(n) || n <= 0 ? 0 : (n >= UINT32_MAX ? UINT32_MAX : (uint32_t)n); }\n` +
      `[[maybe_unused]] static int16_t codelabSchedulerPower(double n) { return !isfinite(n) ? 0 : (int16_t)(n < 0 ? -1 : 1) * (int16_t)(n < 0 ? (n < -100 ? 100 : -n) : (n > 100 ? 100 : n)); }\n` +
      scripts.map(script => script.definition).join('\n'),
    setup: scripts.map(script => script.registration).join('\n') + '\n',
    loop: `static void codelabSchedulerLoop() {\n` +
      `  const uint32_t nowMs = millis();\n` +
      `  const bool shareEdge = robot4wd.buttonEdge(8, true);\n` +
      `  if (shareEdge || (codelabScheduler.state() == codelab::v2::LifecycleState::RUN && !robot4wd.controllerArmed())) codelabScheduler.stop(nowMs);\n` +
      `  if (codelabScheduler.state() == codelab::v2::LifecycleState::RUN && !robot4wd.connected()) codelabScheduler.fault(codelab::v2::FaultCode::LINK_LOST, nowMs);\n` +
      `  if (robot4wd.buttonEdge(12, true)) codelabScheduler.clearFault();\n` +
      `  if (!shareEdge && codelabSchedulerRegistered && codelabScheduler.state() == codelab::v2::LifecycleState::READY && robot4wd.controllerArmed()) codelabScheduler.startController(nowMs);\n` +
      `  if (codelabScheduler.state() != codelab::v2::LifecycleState::RUN) { codelabDriveMode = 0; codelabDriveTimed = false; }\n` +
      `  if (codelabScheduler.state() == codelab::v2::LifecycleState::RUN) {\n` +
      `    codelabUpdateTimedDrive(nowMs);\n` +
      `    codelabApplyDrive();\n` +
      `    for (uint8_t button = 0; button < 17; ++button) {\n` +
      `      if (robot4wd.buttonEdge(button, true)) codelabScheduler.buttonEdge(button, codelab::v2::Edge::PRESS, nowMs);\n` +
      `      if (robot4wd.buttonEdge(button, false)) codelabScheduler.buttonEdge(button, codelab::v2::Edge::RELEASE, nowMs);\n` +
      `    }\n    codelabScheduler.tick(nowMs);\n    codelabUpdateTimedDrive(nowMs);\n    if (codelabScheduler.state() != codelab::v2::LifecycleState::RUN) { codelabDriveMode = 0; codelabDriveTimed = false; }\n    else codelabApplyDrive();\n  }\n}`,
  };
}
