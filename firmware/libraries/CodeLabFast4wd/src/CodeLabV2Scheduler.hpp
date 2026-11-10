#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace codelab::v2 {

enum class StepResult : uint8_t { YIELD = 0, DONE = 1, WAIT = 2 };
enum class WaitKind : uint8_t { NONE, TIMER, HANDLE };
enum class LifecycleState : uint8_t { INIT, READY, RUN, FAULT };
enum class FaultCode : uint16_t { NONE, LOOP_STALL, AUTO_MAX_RUNTIME, SCRIPT_LIMIT, INLINE_RECURSION, INLINE_LIMIT, LINK_LOST };
enum class ScriptState : uint8_t { INACTIVE, RUNNABLE, WAITING, DONE, CANCELED };
enum class HatKind : uint8_t { START, BUTTON_EDGE };
enum class Edge : uint8_t { PRESS, RELEASE };
enum class HandleState : uint8_t { FREE, ACTIVE, COMPLETE, CANCELED };

struct ScriptContext {
  uint32_t scriptUid = 0;
  uint16_t pc = 0;
  uint32_t deadlineMs = 0;
  uint32_t handleId = 0;
  WaitKind waitKind = WaitKind::NONE;
  uint32_t loopCounters[4] = {};
  uint32_t runGeneration = 0;
  bool active = false;
  uint32_t frameData[16] = {};
};

using ScriptStep = StepResult (*)(ScriptContext& ctx, uint32_t nowMs);

struct MockPs4 {
  bool pressed[17]{};
  uint32_t sequence = 0;
};

struct MotorCommand {
  int16_t power = 0;
  uint32_t generation = 0;
  uint32_t handleId = 0;
};

struct TraceEvent {
  char kind[20]{};
  uint32_t atMs = 0;
  uint32_t value = 0;
};

class MotorOutputGate {
 public:
  virtual ~MotorOutputGate() = default;
  virtual void hardLock() = 0;
  virtual bool unlock(uint32_t generation) = 0;
  virtual bool write(uint8_t motor, int16_t power, uint32_t generation, uint32_t handleId = 0) = 0;
  virtual bool stopIfOwned(uint8_t motor, uint32_t generation, uint32_t handleId) = 0;
};

class MockMotorOutputGate : public MotorOutputGate {
 public:
  void hardLock() override;
  bool unlock(uint32_t generation) override;
  bool write(uint8_t motor, int16_t power, uint32_t generation, uint32_t handleId = 0) override;
  bool stopIfOwned(uint8_t motor, uint32_t generation, uint32_t handleId) override;
  bool locked() const { return locked_; }
  const MotorCommand& command(uint8_t motor) const { return outputs_.at(motor); }
 private:
  bool locked_ = true;
  uint32_t generation_ = 0;
  std::array<MotorCommand, 6> outputs_{};
};

class Scheduler {
 public:
  static constexpr size_t kMaxScripts = 16;
  static constexpr size_t kMaxHandles = 16;
  static constexpr uint32_t kHeartbeatTargetMs = 50;
  static constexpr uint32_t kHeartbeatTimeoutMs = 250;
  static constexpr uint32_t kOpsPerScriptTick = 256;
  static constexpr uint32_t kMaxExpandedOps = 1024;
  static constexpr size_t kMaxFrameBytes = 256;

  explicit Scheduler(MotorOutputGate& gate);
  bool registerScript(uint32_t scriptUid, ScriptStep stepFunc);
  bool registerEventScript(uint32_t scriptUid, ScriptStep stepFunc, uint8_t button, Edge edge);
  bool startAuto(uint32_t nowMs, uint32_t maxRunMs);
  bool startController(uint32_t nowMs);
  void stop(uint32_t nowMs);
  void fault(FaultCode code, uint32_t nowMs);
  bool clearFault();
  void buttonEdge(uint8_t button, Edge edge, uint32_t nowMs);
  void safetyPhase(uint32_t nowMs);
  void tick(uint32_t nowMs);
  bool motorWrite(uint8_t motor, int16_t power, uint32_t nowMs);
  uint32_t motorRunFor(uint8_t motor, int16_t power, uint32_t durationMs, uint32_t nowMs);
  bool handleDone(uint32_t handleId) const;
  bool handleActive(uint32_t handleId) const;
  bool isIdle() const;
  ScriptState scriptState(uint32_t scriptUid) const;
  size_t scriptCount() const { return scriptCount_; }
  size_t pendingCount(uint32_t scriptUid) const;
  LifecycleState state() const { return state_; }
  FaultCode faultCode() const { return faultCode_; }
  uint32_t runGeneration() const { return runGeneration_; }
  uint32_t heartbeatAt() const { return heartbeatAt_; }
  uint32_t callbackOperations() const { return callbackOperations_; }
  uint32_t maxCallbackOperations() const { return maxCallbackOperations_; }
  uint64_t totalOperations() const { return totalOperations_; }
  bool accountOperations(ScriptContext& ctx, uint32_t count = 1);
  const MockPs4& ps4() const { return ps4_; }
  const std::array<TraceEvent, 256>& trace() const { return trace_; }
  size_t traceCount() const { return traceCount_; }
  uint32_t traceDrops() const { return traceDrops_; }

 private:
  struct Slot {
    ScriptContext ctx{};
    ScriptStep step = nullptr;
    ScriptState state = ScriptState::INACTIVE;
    HatKind hat = HatKind::START;
    uint8_t button = 0;
    Edge edge = Edge::PRESS;
    bool pending = false;
    uint32_t pendingSequence = 0;
    uint16_t operationsThisTick = 0;
  };
  struct MotionHandle {
    uint32_t id = 0;
    uint32_t ownerGeneration = 0;
    uint32_t deadlineMs = 0;
    uint8_t motor = 0;
    HandleState state = HandleState::FREE;
  };
  Slot* find(uint32_t scriptUid);
  const Slot* find(uint32_t scriptUid) const;
  MotionHandle* findHandle(uint32_t id);
  const MotionHandle* findHandle(uint32_t id) const;
  void cancelAll(uint32_t nowMs);
  void updateMotions(uint32_t nowMs);
  bool tokenStillValid(const Slot& slot) const;
  void record(const char* kind, uint32_t atMs, uint32_t value = 0);

  MotorOutputGate& gate_;
  std::array<Slot, kMaxScripts> slots_{};
  std::array<MotionHandle, kMaxHandles> handles_{};
  size_t scriptCount_ = 0;
  size_t cursor_ = 0;
  uint32_t runGeneration_ = 0;
  uint32_t heartbeatAt_ = 0;
  uint32_t autoDeadlineMs_ = 0;
  uint32_t nextHandleId_ = 1;
  uint32_t callbackOperations_ = 0;
  uint32_t maxCallbackOperations_ = 0;
  uint64_t totalOperations_ = 0;
  LifecycleState state_ = LifecycleState::READY;
  bool controllerMode_ = false;
  FaultCode faultCode_ = FaultCode::NONE;
  MockPs4 ps4_{};
  std::array<TraceEvent, 256> trace_{};
  size_t traceCount_ = 0;
  uint32_t traceDrops_ = 0;
};

struct InlineCheck {
  bool valid = true;
  uint32_t expandedOps = 0;
  size_t frameBytes = 0;
  std::string error;
};
InlineCheck validateInlineGraph(const std::vector<std::vector<uint8_t>>& calls,
                                uint32_t expandedOps, size_t frameBytes);

} // namespace codelab::v2
