#include "scheduler.hpp"

#include <functional>
#include <cstring>

namespace codelab::v2 {

void MockMotorOutputGate::hardLock() {
  locked_ = true;
  for (auto& output : outputs_) output = {};
}

bool MockMotorOutputGate::unlock(uint32_t generation) {
  generation_ = generation;
  locked_ = false;
  return true;
}

bool MockMotorOutputGate::write(uint8_t motor, int16_t power, uint32_t generation, uint32_t handleId) {
  if (motor >= outputs_.size() || locked_ || generation != generation_) return false;
  outputs_[motor] = {power, generation, handleId};
  return true;
}

bool MockMotorOutputGate::stopIfOwned(uint8_t motor, uint32_t generation, uint32_t handleId) {
  if (motor >= outputs_.size()) return false;
  auto& out = outputs_[motor];
  if (out.generation != generation || out.handleId != handleId) return false;
  out.power = 0;
  out.handleId = 0;
  return true;
}

Scheduler::Scheduler(MockMotorOutputGate& gate) : gate_(gate) {}

bool Scheduler::registerScript(uint32_t id, ScriptStep step) {
  if (!step || find(id) || scriptCount_ == kMaxScripts) return false;
  auto& slot = slots_[scriptCount_++];
  slot.ctx.scriptUid = id;
  slot.step = step;
  slot.hat = HatKind::START;
  slot.state = ScriptState::INACTIVE;
  return true;
}

bool Scheduler::registerEventScript(uint32_t id, ScriptStep step, uint8_t button, Edge edge) {
  if (button >= 17 || !registerScript(id, step)) return false;
  auto* slot = find(id);
  slot->hat = HatKind::BUTTON_EDGE;
  slot->button = button;
  slot->edge = edge;
  return true;
}

bool Scheduler::startAuto(uint32_t nowMs, uint32_t maxRunMs) {
  if (state_ != LifecycleState::READY || maxRunMs == 0 || maxRunMs > 60'000) return false;
  ++runGeneration_;
  if (!runGeneration_) ++runGeneration_;
  state_ = LifecycleState::RUN;
  faultCode_ = FaultCode::NONE;
  autoDeadlineMs_ = nowMs + maxRunMs;
  heartbeatAt_ = nowMs;
  // Reset every continuation while retaining the registered stable script IDs.
  for (size_t i = 0; i < scriptCount_; ++i) {
    auto& s = slots_[i];
    const uint32_t id = s.ctx.scriptUid;
    s.ctx = {};
    s.ctx.scriptUid = id;
    s.ctx.runGeneration = runGeneration_;
    s.ctx.active = s.hat == HatKind::START;
    s.pending = false;
    s.state = s.hat == HatKind::START ? ScriptState::RUNNABLE : ScriptState::INACTIVE;
  }
  for (auto& h : handles_) h = {};
  cursor_ = 0;
  gate_.unlock(runGeneration_);
  record("start", nowMs, runGeneration_);
  return true;
}

void Scheduler::cancelAll(uint32_t nowMs) {
  gate_.hardLock();
  for (size_t i = 0; i < scriptCount_; ++i) {
    auto& s = slots_[i];
    s.pending = false;
    s.ctx.active = false;
    s.ctx.waitKind = WaitKind::NONE;
    s.state = ScriptState::CANCELED;
  }
  for (auto& h : handles_) if (h.state == HandleState::ACTIVE) h.state = HandleState::CANCELED;
  record("cancel", nowMs);
}

void Scheduler::stop(uint32_t nowMs) {
  if (state_ != LifecycleState::RUN) return;
  state_ = LifecycleState::READY; // STOP wins before cleanup and any stale write.
  ++runGeneration_;
  if (!runGeneration_) ++runGeneration_;
  cancelAll(nowMs);
  faultCode_ = FaultCode::NONE;
  record("stop", nowMs);
}

void Scheduler::fault(FaultCode code, uint32_t nowMs) {
  if (state_ == LifecycleState::FAULT) return;
  state_ = LifecycleState::FAULT;
  ++runGeneration_;
  if (!runGeneration_) ++runGeneration_;
  faultCode_ = code;
  cancelAll(nowMs);
  record("fault", nowMs, static_cast<uint32_t>(code));
}

void Scheduler::buttonEdge(uint8_t button, Edge edge, uint32_t nowMs) {
  if (button >= 17) return;
  ++ps4_.sequence;
  ps4_.pressed[button] = edge == Edge::PRESS;
  record(edge == Edge::PRESS ? "press" : "release", nowMs, button);
  if (state_ != LifecycleState::RUN) return;
  for (size_t i = 0; i < scriptCount_; ++i) {
    auto& s = slots_[i];
    if (s.hat != HatKind::BUTTON_EDGE || s.button != button ||
        s.state == ScriptState::DONE || s.state == ScriptState::CANCELED) continue;
    if (s.edge == edge) {
      s.pending = true;
      s.pendingSequence = ps4_.sequence;
    } else {
      // An opposite edge invalidates a queued token for this hat.
      s.pending = false;
      if (!s.ctx.active && s.state == ScriptState::WAITING) s.state = ScriptState::INACTIVE;
    }
    if (s.state == ScriptState::INACTIVE && s.pending) s.state = ScriptState::WAITING;
  }
}

bool Scheduler::tokenStillValid(const Slot& s) const {
  return s.pending && ps4_.pressed[s.button] == (s.edge == Edge::PRESS);
}

void Scheduler::record(const char* kind, uint32_t atMs, uint32_t value) {
  if (traceCount_ >= trace_.size()) { ++traceDrops_; return; }
  auto& event = trace_[traceCount_++];
  std::strncpy(event.kind, kind, sizeof(event.kind) - 1);
  event.atMs = atMs;
  event.value = value;
}

void Scheduler::safetyPhase(uint32_t nowMs) {
  if (state_ != LifecycleState::RUN) return;
  if (static_cast<int32_t>(nowMs - autoDeadlineMs_) >= 0) {
    fault(FaultCode::AUTO_MAX_RUNTIME, nowMs);
    return;
  }
  if (static_cast<uint32_t>(nowMs - heartbeatAt_) > kHeartbeatTimeoutMs) fault(FaultCode::LOOP_STALL, nowMs);
}

void Scheduler::tick(uint32_t nowMs) {
  safetyPhase(nowMs);
  if (state_ != LifecycleState::RUN) return;
  updateMotions(nowMs);
  callbackOperations_ = 0;
  for (size_t i = 0; i < scriptCount_; ++i) slots_[i].operationsThisTick = 0;
  for (size_t dispatched = 0; dispatched < scriptCount_; ++dispatched) {
    const size_t index = cursor_++ % scriptCount_;
    auto& s = slots_[index];
    if (s.state == ScriptState::INACTIVE || s.state == ScriptState::DONE || s.state == ScriptState::CANCELED) continue;
    if (s.hat == HatKind::BUTTON_EDGE) {
      if (s.pending) {
        if (!tokenStillValid(s)) {
          s.pending = false;
          if (!s.ctx.active) s.state = ScriptState::INACTIVE;
          continue;
        }
        if (s.ctx.active) continue; // one pending token waits until this invocation completes
        const uint32_t id = s.ctx.scriptUid;
        s.ctx = {};
        s.ctx.scriptUid = id;
        s.ctx.runGeneration = runGeneration_;
        s.ctx.active = true;
        s.pending = false;
      } else if (!s.ctx.active) {
        continue;
      }
    }
    if (s.state == ScriptState::WAITING) {
      if (s.ctx.waitKind == WaitKind::TIMER && static_cast<int32_t>(nowMs - s.ctx.deadlineMs) < 0) continue;
      if (s.ctx.waitKind == WaitKind::HANDLE && !handleDone(s.ctx.handleId)) continue;
      if (s.ctx.waitKind == WaitKind::TIMER || s.ctx.waitKind == WaitKind::HANDLE) s.ctx.waitKind = WaitKind::NONE;
    }
    s.state = ScriptState::RUNNABLE;
    s.pending = false;
    s.ctx.active = true;
    const StepResult result = s.step(s.ctx, nowMs);
    if (result == StepResult::DONE) {
      if (s.hat == HatKind::BUTTON_EDGE) {
        const uint32_t id = s.ctx.scriptUid;
        s.ctx = {};
        s.ctx.scriptUid = id;
        s.ctx.runGeneration = runGeneration_;
        s.state = s.pending ? ScriptState::WAITING : ScriptState::INACTIVE;
      } else {
        s.state = ScriptState::DONE;
        s.ctx.active = false;
        s.ctx.waitKind = WaitKind::NONE;
      }
    } else if (result == StepResult::WAIT) {
      if (s.ctx.waitKind == WaitKind::NONE) {
        fault(FaultCode::INLINE_LIMIT, nowMs); // malformed callback contract fails closed
        return;
      }
      s.state = ScriptState::WAITING;
    } else {
      s.state = s.ctx.active ? (s.hat == HatKind::BUTTON_EDGE ? ScriptState::WAITING : ScriptState::RUNNABLE)
                             : (s.hat == HatKind::BUTTON_EDGE ? ScriptState::INACTIVE : ScriptState::RUNNABLE);
    }
    if (state_ != LifecycleState::RUN) return;
  }
  updateMotions(nowMs);
  heartbeatAt_ = nowMs; // only after the tick returns through all bounded callbacks
  record("heartbeat", nowMs);
  if (isIdle()) {
    state_ = LifecycleState::READY;
    ++runGeneration_;
    if (!runGeneration_) ++runGeneration_;
    cancelAll(nowMs);
    record("auto-done", nowMs);
  }
}

bool Scheduler::motorWrite(uint8_t motor, int16_t power, uint32_t nowMs) {
  (void)nowMs;
  if (state_ != LifecycleState::RUN) return false;
  // A new accepted write invalidates any previous timed-motion owner on channel.
  for (auto& h : handles_) if (h.state == HandleState::ACTIVE && h.motor == motor) h.state = HandleState::CANCELED;
  return gate_.write(motor, power, runGeneration_, 0);
}

bool Scheduler::accountOperations(ScriptContext& ctx, uint32_t count) {
  auto* slot = find(ctx.scriptUid);
  if (!slot || count > kOpsPerScriptTick || slot->operationsThisTick + count > kOpsPerScriptTick) return false;
  slot->operationsThisTick = static_cast<uint16_t>(slot->operationsThisTick + count);
  callbackOperations_ += count;
  totalOperations_ += count;
  if (slot->operationsThisTick > maxCallbackOperations_) maxCallbackOperations_ = slot->operationsThisTick;
  return true;
}

uint32_t Scheduler::motorRunFor(uint8_t motor, int16_t power, uint32_t durationMs, uint32_t nowMs) {
  if (state_ != LifecycleState::RUN || motor >= 6) return 0;
  MotionHandle* free = nullptr;
  for (auto& h : handles_) if (h.state != HandleState::ACTIVE) { free = &h; break; }
  if (!free) return 0;
  for (auto& h : handles_) if (h.state == HandleState::ACTIVE && h.motor == motor) h.state = HandleState::CANCELED;
  uint32_t id = nextHandleId_++;
  if (!id) id = nextHandleId_++;
  *free = {id, runGeneration_, nowMs + durationMs, motor, HandleState::ACTIVE};
  if (!gate_.write(motor, power, runGeneration_, id)) { free->state = HandleState::CANCELED; return 0; }
  return id;
}

bool Scheduler::handleDone(uint32_t id) const {
  const auto* h = findHandle(id);
  return !h || h->state == HandleState::COMPLETE || h->state == HandleState::CANCELED;
}

bool Scheduler::handleActive(uint32_t id) const {
  const auto* h = findHandle(id);
  return h && h->state == HandleState::ACTIVE;
}

bool Scheduler::isIdle() const {
  for (size_t i = 0; i < scriptCount_; ++i) {
    const auto& s = slots_[i];
    if (s.state == ScriptState::RUNNABLE || s.state == ScriptState::WAITING || s.pending) return false;
  }
  for (const auto& h : handles_) if (h.state == HandleState::ACTIVE) return false;
  return true;
}

ScriptState Scheduler::scriptState(uint32_t id) const {
  const auto* s = find(id);
  return s ? s->state : ScriptState::INACTIVE;
}

size_t Scheduler::pendingCount(uint32_t id) const {
  const auto* s = find(id);
  return s && s->pending ? 1 : 0;
}

Scheduler::Slot* Scheduler::find(uint32_t id) {
  for (size_t i = 0; i < scriptCount_; ++i) if (slots_[i].ctx.scriptUid == id) return &slots_[i];
  return nullptr;
}
const Scheduler::Slot* Scheduler::find(uint32_t id) const {
  for (size_t i = 0; i < scriptCount_; ++i) if (slots_[i].ctx.scriptUid == id) return &slots_[i];
  return nullptr;
}
Scheduler::MotionHandle* Scheduler::findHandle(uint32_t id) {
  for (auto& h : handles_) if (h.id == id) return &h;
  return nullptr;
}
const Scheduler::MotionHandle* Scheduler::findHandle(uint32_t id) const {
  for (const auto& h : handles_) if (h.id == id) return &h;
  return nullptr;
}

void Scheduler::updateMotions(uint32_t nowMs) {
  for (auto& h : handles_) {
    if (h.state != HandleState::ACTIVE || static_cast<int32_t>(nowMs - h.deadlineMs) < 0) continue;
    gate_.stopIfOwned(h.motor, h.ownerGeneration, h.id);
    h.state = HandleState::COMPLETE;
    record("motion-done", nowMs, h.id);
  }
}

InlineCheck validateInlineGraph(const std::vector<std::vector<uint8_t>>& calls,
                                uint32_t expandedOps, size_t frameBytes) {
  InlineCheck result{true, expandedOps, frameBytes, {}};
  if (expandedOps > Scheduler::kMaxExpandedOps || frameBytes > Scheduler::kMaxFrameBytes) {
    result.valid = false; result.error = "V2_PROC_INLINE_LIMIT"; return result;
  }
  std::vector<uint8_t> color(calls.size());
  std::function<bool(size_t)> visit = [&](size_t node) {
    color[node] = 1;
    for (uint8_t child : calls[node]) {
      if (child >= calls.size()) { result.error = "V2_PROC_UNKNOWN_TARGET"; return false; }
      if (color[child] == 1) { result.error = "V2_PROC_RECURSION"; return false; }
      if (color[child] == 0 && !visit(child)) return false;
    }
    color[node] = 2;
    return true;
  };
  for (size_t i = 0; i < calls.size(); ++i) if (!color[i] && !visit(i)) { result.valid = false; return result; }
  return result;
}

} // namespace codelab::v2
