#include "scheduler.hpp"

#include <cstdlib>
#include <chrono>
#include <cstring>
#include <iostream>
#include <string>

using namespace codelab::v2;

static Scheduler* g = nullptr;
static uint32_t xStarts = 0, xEndAt = 0, oStarts = 0, rapidStarts = 0, foreverSteps = 0, peerSteps = 0;
static uint32_t waitRepeatOps = 0, inlineResume = 0, autoRuns = 0, quotaPc = 0;
static bool timedWait = true;

static bool op(ScriptContext& ctx, uint32_t n = 1) { return g->accountOperations(ctx, n); }
static void require(bool ok, const char* message) {
  if (!ok) { std::cerr << "FAIL: " << message << '\n'; std::exit(1); }
}
static void passed(const char* name) { std::cout << "PASS: " << name << '\n'; }

static StepResult xWait2000(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  if (ctx.pc == 0) {
    ++xStarts; g->motorWrite(0, 50, now); ctx.deadlineMs = now + 2000; ctx.waitKind = WaitKind::TIMER; ctx.pc = 1; return StepResult::WAIT;
  }
  if (ctx.pc == 1) { g->motorWrite(0, 0, now); xEndAt = now; return StepResult::DONE; }
  return StepResult::DONE;
}
static StepResult motorOn50(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  g->motorWrite(0, 50, now);
  return StepResult::DONE;
}
static StepResult motorOff(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  g->motorWrite(0, 0, now);
  return StepResult::DONE;
}
static StepResult oImmediate(ScriptContext& ctx, uint32_t) { if (!op(ctx)) return StepResult::YIELD; ++oStarts; ctx.pc++; return StepResult::DONE; }
static StepResult stopWait(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  if (!ctx.pc++) { g->motorWrite(0, 55, now); ctx.deadlineMs = now + 2000; ctx.waitKind = WaitKind::TIMER; return StepResult::WAIT; }
  return StepResult::DONE;
}
static StepResult rapidHat(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  if (!ctx.pc) { ++rapidStarts; g->motorWrite(0, 30, now); ctx.pc = 1; ctx.deadlineMs = now + 10; ctx.waitKind = WaitKind::TIMER; return StepResult::WAIT; }
  g->motorWrite(0, 0, now); return StepResult::DONE;
}
static StepResult foreverEmpty(ScriptContext& ctx, uint32_t) {
  if (!op(ctx)) return StepResult::YIELD;
  ++foreverSteps;
  // Empty forever body still returns to scheduler every iteration.
  return StepResult::YIELD;
}
static StepResult peerOnce(ScriptContext& ctx, uint32_t) { if (!op(ctx)) return StepResult::YIELD; ++peerSteps; return StepResult::DONE; }
static StepResult nestedRepeatIf(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  if (ctx.pc == 0) { ctx.pc = 1; ctx.loopCounters[0] = 0; }
  if (ctx.pc == 1) {
    if (ctx.loopCounters[0] < 3) { ++ctx.loopCounters[0]; ++waitRepeatOps; ctx.deadlineMs = now + 5; ctx.waitKind = WaitKind::TIMER; ctx.pc = 2; return StepResult::WAIT; }
    ctx.pc = 3;
  }
  if (ctx.pc == 2) { ctx.pc = 1; return StepResult::YIELD; }
  return StepResult::DONE;
}
static StepResult continuous(ScriptContext& ctx, uint32_t) { if (!op(ctx)) return StepResult::YIELD; ++foreverSteps; return StepResult::YIELD; }
static StepResult createTimedMotion(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  if (!ctx.pc) {
    ctx.handleId = g->motorRunFor(1, 60, 100, now);
    require(ctx.handleId != 0, "timed motion handle created");
    ctx.pc = 1;
    if (timedWait) { ctx.waitKind = WaitKind::HANDLE; return StepResult::WAIT; }
    return StepResult::DONE;
  }
  ++inlineResume;
  return StepResult::DONE;
}
static StepResult inlineBlockWait(ScriptContext& ctx, uint32_t now) {
  if (!op(ctx)) return StepResult::YIELD;
  if (ctx.pc == 0) { ctx.frameData[0] = 42; ctx.deadlineMs = now + 20; ctx.waitKind = WaitKind::TIMER; ctx.pc = 1; return StepResult::WAIT; }
  require(ctx.frameData[0] == 42, "inline argument preserved across wait");
  ++inlineResume; return StepResult::DONE;
}
static StepResult countAutoRun(ScriptContext& ctx, uint32_t) { if (!op(ctx)) return StepResult::YIELD; ++autoRuns; return StepResult::DONE; }
static StepResult burnQuota(ScriptContext& ctx, uint32_t) {
  while (quotaPc < 260) {
    if (!op(ctx)) return StepResult::YIELD;
    ++quotaPc;
  }
  return StepResult::DONE;
}

struct VirtualClock {
  uint32_t now = 0;
  void tick(Scheduler& scheduler, uint32_t at) { now = at; scheduler.tick(now); }
  void maintain(Scheduler& scheduler, uint32_t through) {
    while (now + 50 <= through) { now += 50; scheduler.tick(now); }
  }
};

static void test_XO_independence_and_x_resume() {
  MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock clock;
  require(s.registerEventScript(1, xWait2000, 0, Edge::PRESS), "register X");
  require(s.registerEventScript(2, oImmediate, 1, Edge::PRESS), "register O");
  require(s.startAuto(0, 10000), "start X/O run");
  s.buttonEdge(0, Edge::PRESS, 0); clock.tick(s, 0);
  require(xStarts == 1 && s.scriptState(1) == ScriptState::WAITING && gate.command(0).power == 50, "X starts M1 at 50 and waits independently");
  clock.maintain(s, 450);
  s.buttonEdge(1, Edge::PRESS, 500); clock.tick(s, 500);
  require(oStarts == 1, "O dispatched during X wait");
  clock.maintain(s, 1950);
  clock.tick(s, 2000);
  require(gate.command(0).power == 0 && xEndAt == 2000, "X continuation completed at 2000ms");
  passed("X t=0 / O t=500 / X continuation t=2000 independent waits");
}

static void test_stop_priority() {
  MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock c;
  require(s.registerScript(1, stopWait), "register stop test"); require(s.startAuto(0, 5000), "start stop test");
  c.tick(s, 0); require(gate.command(0).power == 55, "motor latched before stop");
  s.stop(750); require(gate.locked() && gate.command(0).power == 0 && s.state() == LifecycleState::READY, "STOP locks before cleanup");
  require(!s.motorWrite(0, 90, 751), "stale command rejected after stop");
  passed("STOP at 750ms cancels waits and wins over stale writes");
}

static void test_rapid_edges() {
  MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock c;
  rapidStarts = 0;
  require(s.registerScript(8, continuous), "register run keepalive");
  require(s.registerEventScript(7, rapidHat, 2, Edge::PRESS), "register rapid hat"); require(s.startAuto(0, 1000), "start rapid run");
  s.buttonEdge(2, Edge::PRESS, 0); c.tick(s, 0); require(rapidStarts == 1, "first press starts once");
  s.buttonEdge(2, Edge::RELEASE, 1); s.buttonEdge(2, Edge::PRESS, 2); s.buttonEdge(2, Edge::RELEASE, 3);
  require(s.pendingCount(7) == 0, "opposite edge clears pending press"); c.tick(s, 3);
  c.tick(s, 10); c.tick(s, 11);
  require(rapidStarts == 1 && gate.command(0).power == 0, "rapid press-release sequence does not replay or leave motor latched on");
  s.buttonEdge(2, Edge::PRESS, 12); c.tick(s, 12); require(rapidStarts == 2, "fresh later press dispatches normally");
  passed("rapid X edge tokens bounded to one and stale PRESS not replayed");
}

static void test_x_press_and_release_latch_motor() {
  MockMotorOutputGate gate; Scheduler s(gate); g = &s;
  require(s.registerEventScript(20, motorOn50, 0, Edge::PRESS), "register X motor start");
  require(s.registerEventScript(21, motorOff, 0, Edge::RELEASE), "register X motor stop");
  require(s.startController(0), "start controller for X latch");
  s.buttonEdge(0, Edge::PRESS, 0); s.tick(0);
  require(gate.command(0).power == 50, "X press latches M1 at 50 percent");
  s.buttonEdge(0, Edge::RELEASE, 10); s.tick(10);
  require(gate.command(0).power == 0 && s.state() == LifecycleState::RUN, "X release stops M1 while controller remains live");
  s.stop(11);
  passed("X press latches M1 50%; X release stops it");
}

static void test_forever_fairness_and_nested_wait() {
  MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock c; foreverSteps = peerSteps = waitRepeatOps = 0;
  require(s.registerScript(1, foreverEmpty) && s.registerScript(2, peerOnce) && s.registerScript(3, nestedRepeatIf), "register fair scripts");
  require(s.startAuto(0, 1000), "start fair scripts"); c.tick(s, 0);
  require(peerSteps == 1 && foreverSteps == 1 && waitRepeatOps == 1, "forever yields and peers run");
  c.tick(s, 5); c.tick(s, 10); c.tick(s, 15); c.tick(s, 20); c.tick(s, 25); c.tick(s, 30);
  require(waitRepeatOps == 3 && s.scriptState(3) == ScriptState::DONE, "nested repeat/if timer continuation");
  passed("empty forever yields; nested repeat/if timer wait does not starve peers");
}

static void test_timer_ownership_and_motion_wait_modes() {
  { MockMotorOutputGate gate; Scheduler s(gate); g = &s;
    require(s.registerScript(1, continuous), "register keepalive"); require(s.startAuto(0, 5000), "start timer ownership");
    s.motorRunFor(0, 25, 100, 0); s.motorWrite(0, 80, 50); s.tick(100);
    require(gate.command(0).power == 80, "expired old timer cannot stop new command"); }
  for (bool wait : {true, false}) {
    MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock c; timedWait = wait; inlineResume = 0;
    require(s.registerScript(1, createTimedMotion), "register motion"); require(s.startAuto(0, 1000), "start motion auto");
    c.tick(s, 0); require(gate.command(1).power == 60, "timed output starts");
    require(s.state() == LifecycleState::RUN, "active handle keeps AUTO alive");
    c.maintain(s, 100); require(gate.command(1).power == 0, "handle deadline stops owned output");
    c.tick(s, 101); require(s.state() == LifecycleState::READY, "AUTO natural completion after handle");
    require(inlineResume == (wait ? 1u : 0u), "WAIT resumes; NO_WAIT does not resume");
  }
  passed("old timer ownership plus timed WAIT/NO_WAIT natural AUTO completion");
}

static void test_inline_wait_recursion_limits_and_reset() {
  { MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock c; inlineResume = 0;
    require(s.registerScript(1, inlineBlockWait), "register inline wait"); require(s.startAuto(0, 1000), "start inline wait");
    c.tick(s, 0); c.tick(s, 20); require(inlineResume == 1 && s.state() == LifecycleState::READY, "inlined wait resumes and finishes"); }
  auto dag = validateInlineGraph({{1}, {}}, 8, 64); require(dag.valid, "acyclic My Blocks accepted");
  auto cycle = validateInlineGraph({{1}, {0}}, 8, 64); require(!cycle.valid && cycle.error == "V2_PROC_RECURSION", "recursive My Blocks rejected");
  auto over = validateInlineGraph({{}}, 1025, 257); require(!over.valid && over.error == "V2_PROC_INLINE_LIMIT", "inline quota rejected");
  { MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock c; autoRuns = 0;
    require(s.registerScript(1, countAutoRun), "register start script");
    require(s.startAuto(0, 1000), "first run"); c.tick(s, 0); require(s.state() == LifecycleState::READY, "first AUTO completes");
    const auto generation = s.runGeneration(); require(s.startAuto(100, 1000), "second explicit START");
    require(s.runGeneration() != generation, "START advances run generation"); c.tick(s, 100); require(autoRuns == 2, "script frame reset for new run"); }
  passed("inline My Block wait, recursion/quota rejection, explicit restart reset");
}

static void test_timeout_watchdog_pool_and_quota() {
  { MockMotorOutputGate gate; Scheduler s(gate); g = &s; VirtualClock c;
    require(s.registerScript(1, continuous), "register timeout keepalive"); require(s.startAuto(0, 15000), "start timeout run");
    c.tick(s, 0); c.maintain(s, 14950); c.tick(s, 14999); c.tick(s, 15000); require(s.state() == LifecycleState::FAULT && s.faultCode() == FaultCode::AUTO_MAX_RUNTIME && gate.locked(), "AUTO max runtime faults"); }
  { MockMotorOutputGate gate; Scheduler s(gate); g = &s; require(s.startAuto(0, 5000), "start heartbeat test");
    s.safetyPhase(251); require(s.state() == LifecycleState::FAULT && s.faultCode() == FaultCode::LOOP_STALL, "stalled scheduler faults after 250ms"); }
  { MockMotorOutputGate gate; Scheduler s(gate); g = &s;
    for (uint32_t i = 0; i < 16; ++i) require(s.registerScript(i + 1, continuous), "register within pool");
    require(!s.registerScript(17, continuous) && s.scriptCount() == 16, "17th script rejected"); }
  { MockMotorOutputGate gate; Scheduler s(gate); g = &s; quotaPc = peerSteps = 0;
    require(s.registerScript(1, burnQuota) && s.registerScript(2, peerOnce), "register quota scripts"); require(s.startAuto(0, 1000), "start quota scripts");
    s.tick(0); require(quotaPc == 256 && s.maxCallbackOperations() <= 256 && peerSteps == 1, "quota yields at 256 while peer gets slot");
    s.tick(1); require(quotaPc == 260, "quota continuation resumes next tick"); }
  passed("AUTO timeout, heartbeat watchdog, 16-script cap, 256-op cooperative quota");
}

static void benchmark() {
  MockMotorOutputGate gate; Scheduler s(gate); g = &s;
  for (uint32_t i = 0; i < 16; ++i) require(s.registerScript(i + 1, continuous), "benchmark registers 16 scripts");
  require(s.startAuto(0, 60000), "benchmark start");
  uint64_t maxNs = 0;
  constexpr uint32_t ticks = 10000;
  for (uint32_t i = 0; i < ticks; ++i) {
    const auto begin = std::chrono::steady_clock::now();
    s.tick(i);
    const auto elapsed = std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now() - begin).count();
    if (static_cast<uint64_t>(elapsed) > maxNs) maxNs = static_cast<uint64_t>(elapsed);
  }
  std::cout << "BENCH: host_ticks=" << ticks << " scripts=16 ops=" << s.totalOperations()
            << " max_tick_ns=" << maxNs << " sizeof_scheduler=" << sizeof(Scheduler)
            << " sizeof_gate=" << sizeof(MockMotorOutputGate)
            << " static_bytes=" << sizeof(Scheduler) + sizeof(MockMotorOutputGate)
            << " max_script_tick_ops=" << s.maxCallbackOperations() << '\n';
  require(s.totalOperations() == 160000, "benchmark operation count");
  require(sizeof(Scheduler) + sizeof(MockMotorOutputGate) < 16 * 1024, "static RAM threshold");
  require(s.traceCount() == 256 && s.traceDrops() > 0, "trace buffer is bounded with drop counter");
  require(maxNs < 2'000'000, "scheduler tick threshold 2ms");
  passed("§9.2 16-script benchmark: operation, static RAM, and 2ms tick budgets");
}

static void test_deterministic_trace() {
  MockMotorOutputGate gateA, gateB; Scheduler a(gateA), b(gateB);
  require(a.registerScript(1, peerOnce) && b.registerScript(1, peerOnce), "register trace scripts");
  g = &a; require(a.startAuto(123, 1000), "trace start A"); a.tick(123);
  g = &b; require(b.startAuto(123, 1000), "trace start B"); b.tick(123);
  require(a.traceCount() == b.traceCount(), "trace lengths match");
  for (size_t i = 0; i < a.traceCount(); ++i) {
    require(std::strcmp(a.trace()[i].kind, b.trace()[i].kind) == 0 && a.trace()[i].atMs == b.trace()[i].atMs && a.trace()[i].value == b.trace()[i].value,
            "equal inputs produce equal traces");
  }
  passed("identical virtual-time/input traces produce byte-stable ordered events");
}

static void test_controller_mode_keeps_event_hats_live_and_fault_locked() {
  MockMotorOutputGate gate; Scheduler s(gate); g = &s;
  oStarts = 0;
  require(s.registerEventScript(12, oImmediate, 1, Edge::PRESS), "register controller event");
  require(s.startController(0), "start unbounded controller mode");
  s.buttonEdge(1, Edge::PRESS, 0); s.tick(0);
  require(oStarts == 1 && s.state() == LifecycleState::RUN, "controller dispatches button edge");
  for (uint32_t now = 50; now <= 60'000; now += 50) s.tick(now);
  require(s.state() == LifecycleState::RUN, "controller mode does not apply AUTO timeout");
  s.fault(FaultCode::LINK_LOST, 60'001);
  require(gate.locked() && s.state() == LifecycleState::FAULT, "link fault locks the output gate");
  require(s.clearFault() && s.state() == LifecycleState::READY && gate.locked(), "fault clear keeps outputs locked");
  passed("controller mode keeps event hats live until STOP or link fault");
}

int main() {
  test_XO_independence_and_x_resume();
  test_stop_priority();
  test_rapid_edges();
  test_forever_fairness_and_nested_wait();
  test_timer_ownership_and_motion_wait_modes();
  test_inline_wait_recursion_limits_and_reset();
  test_timeout_watchdog_pool_and_quota();
  test_x_press_and_release_latch_motor();
  test_controller_mode_keeps_event_hats_live_and_fault_locked();
  test_deterministic_trace();
  benchmark();
  std::cout << "RESULT: all deterministic virtual-clock tests passed\n";
}
