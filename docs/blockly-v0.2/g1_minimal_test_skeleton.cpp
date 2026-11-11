#include <cassert>
#include <cstdint>
using namespace codelab::v2;

static uint32_t virtualNow = 0;
static StepResult immediate(ScriptContext& ctx, uint32_t) {
  ctx.pc++;
  return ctx.pc == 1 ? StepResult::YIELD : StepResult::DONE;
}

int main() {
  MockMotorOutputGate gate;
  VirtualSafetyMonitor safety(gate); // single-thread deterministic mock
  MockCooperativeScheduler scheduler(safety, /*capacity=*/16);
  ScriptContext context{};
  assert(scheduler.registerScript(1, immediate));
  assert(!scheduler.registerScript(17, immediate)); // bounded pool
  scheduler.tick(virtualNow++);
  assert(scheduler.scriptState(1) == ScriptState::RUNNABLE);
  scheduler.tick(virtualNow++);
  assert(scheduler.scriptState(1) == ScriptState::DONE);

  // YIELD / timer WAIT / handle WAIT / DONE, 16-script cap, fixed round-robin
  // tie ordering, deadline wrap, 100 edge tokens + STOP at 750ms, and watchdog
  // stall: advance virtualNow >250ms without tick; assert HARD_LOCKED + FAULT.
}
