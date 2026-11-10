const EDGE_BUTTONS = { CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L1: 4, R1: 5,
  L2: 6, R2: 7, SHARE: 8, OPTIONS: 9, L3: 10, R3: 11, PS: 12,
  UP: 13, DOWN: 14, LEFT: 15, RIGHT: 16 };

const stableUid = id => {
  let hash = 2166136261;
  for (const ch of id) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return (hash >>> 0) || 1;
};

function motorPort(block, gen) {
  const motor = gen.fast4wd_.devices?.motors.find(item => item.id === block.getFieldValue('MOTOR'));
  return motor ? motor.port - 1 : -1;
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
    for (let b = first; b; b = b.getNextBlock()) blocks.push(b);
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
    ? `codelabSchedulerRegistered = codelabSchedulerRegistered && codelabScheduler.registerEventScript(${uid}UL, ${fn}, ${EDGE_BUTTONS[block.getFieldValue('BUTTON')] ?? 0}, codelab::v2::Edge::${block.getFieldValue('EDGE') === 'RELEASE' ? 'RELEASE' : 'PRESS'});`
    : `codelabSchedulerRegistered = codelabSchedulerRegistered && codelabScheduler.registerScript(${uid}UL, ${fn});`;
  const casesText = cases.map(({ pc, body }) => `    case ${pc}: { ${body} }`).join('\n');
  return {
    fn,
    definition: `static codelab::v2::StepResult ${fn}(codelab::v2::ScriptContext& ctx, uint32_t nowMs) {\n` +
      `  if (!codelabScheduler.accountOperations(ctx)) { codelabScheduler.fault(codelab::v2::FaultCode::INLINE_LIMIT, nowMs); return codelab::v2::StepResult::DONE; }\n` +
      `  if (ctx.pc == 0) ctx.pc = ${entry};\n` +
      `  switch (ctx.pc) {\n${casesText}\n` +
      `    default: return codelab::v2::StepResult::DONE;\n  }\n}`,
    registration: arms,
  };
}

export function generateV2Scheduler(workspace, gen) {
  const top = workspace.getTopBlocks(true).filter(block => block.isEnabled() && !block.getInheritedDisabled());
  const hats = top.filter(block => block.type === 'robot_ps4_event' || block.type === 'beginner_forever');
  if (!hats.length) return { definitions: '', setup: '', loop: '' };
  if (hats.length > 16) throw new Error('V2_SCRIPT_LIMIT: tối đa 16 script event/forever.');
  const scripts = [];
  for (const hat of hats) scripts.push(compileHat(hat, gen));
  return {
    definitions: `#include <Fast4wdSchedulerGate.h>\n` +
      `static codelab::fast4wd::SchedulerGate codelabSchedulerGate(robot4wd);\n` +
      `static codelab::v2::Scheduler codelabScheduler(codelabSchedulerGate);\n` +
      `static bool codelabSchedulerRegistered = true;\n` +
      `static uint8_t codelabDriveMode = 0; static float codelabDriveValues[3] = {};\n` +
      `static void codelabDriveFromPs4() { codelabDriveMode = 1; }\n` +
      `static void codelabDrive(float forward, float left, float turn) { codelabDriveMode = 2; codelabDriveValues[0] = forward; codelabDriveValues[1] = left; codelabDriveValues[2] = turn; }\n` +
      `static void codelabDrivePercent(float forward, float left, float turn) { codelabDrive(forward / 100.0f, left / 100.0f, turn / 100.0f); }\n` +
      `static void codelabApplyDrive() { if (codelabDriveMode == 1) robot4wd.driveFromPs4(); else if (codelabDriveMode == 2) robot4wd.move(codelabDriveValues[0], codelabDriveValues[1], codelabDriveValues[2]); }\n` +
      `static uint32_t codelabSchedulerRepeatCount(double n) { return !isfinite(n) || n <= 0 ? 0 : (n >= UINT32_MAX ? UINT32_MAX : (uint32_t)n); }\n` +
      `static int16_t codelabSchedulerPower(double n) { return !isfinite(n) ? 0 : (int16_t)(n < 0 ? -1 : 1) * (int16_t)(n < 0 ? (n < -100 ? 100 : -n) : (n > 100 ? 100 : n)); }\n` +
      scripts.map(script => script.definition).join('\n'),
    setup: scripts.map(script => script.registration).join('\n') + '\n',
    loop: `static void codelabSchedulerLoop() {\n` +
      `  const uint32_t nowMs = millis();\n` +
      `  if (robot4wd.buttonEdge(8, true)) codelabScheduler.stop(nowMs);\n` +
      `  if (codelabScheduler.state() == codelab::v2::LifecycleState::RUN && !robot4wd.connected()) codelabScheduler.fault(codelab::v2::FaultCode::LINK_LOST, nowMs);\n` +
      `  if (robot4wd.buttonEdge(12, true)) codelabScheduler.clearFault();\n` +
      `  if (codelabSchedulerRegistered && codelabScheduler.state() == codelab::v2::LifecycleState::READY && robot4wd.controllerArmed()) codelabScheduler.startController(nowMs);\n` +
      `  if (codelabScheduler.state() != codelab::v2::LifecycleState::RUN) codelabDriveMode = 0;\n` +
      `  if (codelabScheduler.state() == codelab::v2::LifecycleState::RUN) {\n` +
      `    codelabApplyDrive();\n` +
      `    for (uint8_t button = 0; button < 17; ++button) {\n` +
      `      if (robot4wd.buttonEdge(button, true)) codelabScheduler.buttonEdge(button, codelab::v2::Edge::PRESS, nowMs);\n` +
      `      if (robot4wd.buttonEdge(button, false)) codelabScheduler.buttonEdge(button, codelab::v2::Edge::RELEASE, nowMs);\n` +
      `    }\n    codelabScheduler.tick(nowMs);\n    if (codelabScheduler.state() != codelab::v2::LifecycleState::RUN) codelabDriveMode = 0;\n  }\n}`,
  };
}
