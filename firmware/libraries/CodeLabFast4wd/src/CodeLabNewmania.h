#pragma once

#include "Fast4wdSchedulerGate.h"
#include "NewmaniaSupport.h"
#include <cmath>
#include <cstdio>
#include <cstring>
#include <type_traits>

// Optional facade. Legacy sketches keep using CodeLabFast4wd unchanged.
namespace codelab { namespace newmania {

enum class Motor : uint8_t { M1, M2, M3, M4 };
enum class Direction : uint8_t { Forward, Reverse };
enum class Axis : uint8_t { LeftX, LeftY, RightX, RightY };
enum class Button : uint8_t {
  X, Circle, Square, Triangle, L1, R1, L2, R2, Share, Options,
  L3, R3, Home, Up, Down, Left, Right
};
enum class ButtonState : uint8_t { Pressed, Held, Released };

// One cursor per Boolean Blockly block. Readers never consume shared input.
struct ButtonCursor { uint64_t event = 0; uint64_t epoch = 0; };

class Board {
 public:
  using Context = v2::ScriptContext;
  using Step = v2::StepResult;
  using Reset = void (*)();

  explicit Board(uint8_t limit = 100, fast4wd::MotorLayout layout = {})
      : robot_(limit, layout), gate_(robot_), scheduler_(gate_) {}
  Board(const Board&) = delete;
  Board& operator=(const Board&) = delete;

  void begin(bool blinkOnLoss = true, bool usesPs4 = false, uint32_t buttons = 0x1fcffU, uint8_t axes = 7) {
    if (begun_) return;
    Serial.begin(115200);
    robot_.configureBlockly(usesPs4, buttons, axes);
    robot_.begin(blinkOnLoss); // Existing wiring, frequency, startup and safety.
    begun_ = true;
  }

  // Called visibly by the student's once-per-RUN sequence. The receiver already
  // runs from begin()/update(), including before ARM. Never calls Wire.begin.
  bool connectPs4() {
    if (!begun_) return false;
    robot_.requirePs4();
    if (!ps4Requested_) { clearEdges(); ps4Requested_ = true; }
    return true; // Enables student reads; pairing/link availability is separate.
  }
  bool ps4Requested() const { return ps4Requested_; }
  bool connected() const { return begun_ && robot_.connected(); }

  bool registerProgram(uint32_t uid, v2::ScriptStep step, Reset reset = nullptr) {
    if (!uid || mainUid_ || !scheduler_.registerScript(uid, step)) return false;
    mainUid_ = uid;
    reset_ = reset;
    return true;
  }

  // Single cooperative main program. No new arbitration policy or event tasks.
  void update() {
    if (!begun_) return;
    robot_.beginLoop();
    const uint32_t now = millis();
    if (motionEpoch_ != robot_.motionEpoch()) {
      motionEpoch_ = robot_.motionEpoch();
      driveActive_ = driveTimed_ = false;
      scheduler_.cancelMotions(now);
      clearEdges();
    }
    scheduler_.safetyPhase(now);

    bool started = false;
    if (!started_ && mainUid_ && scheduler_.state() == v2::LifecycleState::READY) {
      started = scheduler_.startProgram(now);
      if (started) {
        started_ = true;
        resetRun();
        if (reset_) reset_(); // Before the first student statement, every RUN.
      }
    }
    if (running()) {
      // Count observed transitions independently of reader timing. Each Boolean
      // owns its cursor; no reader consumes another reader's transitions. Wait
      // invalidates all cursors and drops edges through its wake-up update.
      if (!started && scheduler_.scriptState(mainUid_) != v2::ScriptState::WAITING) {
        for (uint8_t b = 0; b < 17; ++b) {
          if (robot_.buttonEdge(b, true)) ++pressed_[b];
          if (robot_.buttonEdge(b, false)) ++released_[b];
        }
      }
      updateDriveTimer(now);
      applyDrive();
      scheduler_.tick(now);
      updateDriveTimer(now);
      if (running()) applyDrive();
    }
    if (!running()) { driveActive_ = driveTimed_ = false; clearEdges(); }
    robot_.endLoop(); // Poll/control/STOP/freshness watchdog remain serviced.
    serviceMessages();
  }

  bool running() const { return scheduler_.state() == v2::LifecycleState::RUN; }
  v2::LifecycleState state() const { return scheduler_.state(); }
  v2::FaultCode faultCode() const { return scheduler_.faultCode(); }
  uint32_t runGeneration() const { return scheduler_.runGeneration(); }
  uint32_t heartbeatAt() const { return scheduler_.heartbeatAt(); }
  static uint32_t repeatCount(double count) {
    return !std::isfinite(count) || count <= 0 ? 0 : count >= UINT32_MAX ? UINT32_MAX : static_cast<uint32_t>(count);
  }
  int serialAvailable() const { const int n = Serial.available(); return n < 0 ? 0 : n; }
  int serialRead() { return serialAvailable() > 0 ? Serial.read() : -1; }
  bool beginFor(ForLoop& loop, double& variable, Bounds bounds) {
    const bool valid = loop.begin(variable, bounds);
    if (!valid) message("Buoc lap phai khac 0 va cac gioi han phai huu han.");
    return valid;
  }
  double modulo(Pair values) {
    if (!std::isfinite(values.first) || !std::isfinite(values.second) || values.second == 0) {
      if (!arithmeticErrors_++) message("Khong the chia du voi so chia 0 hoac gia tri khong huu han.");
      return 0;
    }
    return std::fmod(values.first, values.second);
  }
  int32_t randomInt(Pair bounds) {
    int32_t low = Math::integer(bounds.first), high = Math::integer(bounds.second);
    if (low > high) { const auto tmp = low; low = high; high = tmp; }
    // One bounded PRNG step, no rejection loop in a cooperative callback.
    randomState_ ^= randomState_ << 13; randomState_ ^= randomState_ >> 17; randomState_ ^= randomState_ << 5;
    const uint64_t span = uint64_t(int64_t(high) - int64_t(low)) + 1;
    return static_cast<int32_t>(int64_t(low) + int64_t((uint64_t(randomState_) * span) >> 32));
  }

  bool button(Button which, ButtonState mode, ButtonCursor& cursor) const {
    const auto bit = static_cast<uint8_t>(which);
    if (bit >= 17 || !ps4Requested_ || !running() || !connected()) return false;
    if (mode == ButtonState::Held) return robot_.button(bit);
    if (mode != ButtonState::Pressed && mode != ButtonState::Released) return false;
    const auto event = mode == ButtonState::Pressed ? pressed_[bit] : released_[bit];
    if (cursor.epoch != edgeEpoch_) cursor = {0, edgeEpoch_};
    if (cursor.event == event) return false;
    ++cursor.event;
    return true;
  }
  bool held(Button which) const {
    const auto bit = static_cast<uint8_t>(which);
    return bit < 17 && ps4Requested_ && connected() && robot_.button(bit);
  }
  float axis(Axis which) const {
    const auto index = static_cast<uint8_t>(which);
    return begun_ && ps4Requested_ && index < 4 ? robot_.axis(index) : 0;
  }

  bool power(Motor motor, double percent) {
    return canCommand(motor) && scheduler_.motorWrite(port(motor), normalizePower(percent), millis());
  }
  bool spin(Motor motor, Direction direction, double percent) {
    if (direction != Direction::Forward && direction != Direction::Reverse) return false;
    const auto magnitude = normalizePower(std::isfinite(percent) && percent > 0 ? percent : 0);
    return power(motor, direction == Direction::Reverse ? -magnitude : magnitude);
  }
  uint32_t runFor(Motor motor, Direction direction, double percent, uint32_t ms) {
    if (!canCommand(motor) || ms < 1 || ms > 5000 ||
        (direction != Direction::Forward && direction != Direction::Reverse)) return 0;
    const auto magnitude = normalizePower(std::isfinite(percent) && percent > 0 ? percent : 0);
    return scheduler_.motorRunFor(port(motor), direction == Direction::Reverse ? -magnitude : magnitude, ms, millis());
  }
  bool stopMotor(Motor motor) { return power(motor, 0); }
  void stopAllMotors() {
    if (!running()) return;
    for (uint8_t m = 0; m < 4; ++m) stopMotor(static_cast<Motor>(m));
    stopDrive(); // Does not DISARM, matching the existing block.
  }
  void releaseMotor(Motor motor) {
    if (canCommand(motor)) robot_.releaseMotor(port(motor)); // Existing ownership semantics.
  }
  float motorPwm(Motor motor) const { return port(motor) < 4 ? robot_.motorPwm(port(motor)) : 0; }
  bool motionActive(uint32_t handle) const { return scheduler_.handleActive(handle); }

  void mecanum(double forward, double left, double counterclockwise) {
    if (!running() || !robot_.motionAllowed()) return;
    driveTimed_ = false;
    driveActive_ = true;
    drive_[0] = finitePercent(forward);
    drive_[1] = finitePercent(left);
    drive_[2] = finitePercent(counterclockwise);
  }
  void stopDrive() { mecanum(0, 0, 0); }
  bool driveFor(double forward, double left, double counterclockwise, uint32_t ms) {
    if (!running() || ms > 60000) return false;
    if (!ms) { stopDrive(); return true; }
    mecanum(forward, left, counterclockwise);
    driveTimed_ = true;
    driveDeadline_ = millis() + ms;
    return true;
  }

  Step wait(Context& ctx, uint32_t ms, uint16_t nextPc) {
    if (!validContext(ctx)) return Step::DONE;
    if (ms > 60000) { scheduler_.fault(v2::FaultCode::INLINE_LIMIT, millis()); return Step::DONE; }
    clearEdges();
    ctx.pc = nextPc;
    ctx.deadlineMs = millis() + ms;
    ctx.waitKind = v2::WaitKind::TIMER;
    return Step::WAIT;
  }
  Step waitMotion(Context& ctx, uint32_t handle, uint16_t nextPc) {
    if (!validContext(ctx)) return Step::DONE;
    if (!handle) { ctx.pc=nextPc; return Step::YIELD; } // Refused motor command is never queued for reconnect.
    clearEdges();
    ctx.pc = nextPc;
    ctx.handleId = handle;
    ctx.waitKind = v2::WaitKind::HANDLE;
    return Step::WAIT;
  }
  void stop() { scheduler_.stop(millis()); }

  // Bounded nonblocking messages. A future integration consumes popMessage();
  // these helpers never flush Serial or wait for a USB reader.
  bool message(const char* text) {
    return serialPrint(text, true);
  }
  bool serialPrint(const char* text, bool newline = true) {
    if (!text) return false;
    size_t n = 0;
    while (n < kMessageLength && text[n]) ++n;
    if (n == kMessageLength || messageCount_ == kMessages) { ++messageDrops_; return false; }
    std::memcpy(messages_[messageHead_], text, n + 1);
    messageNewline_[messageHead_] = newline;
    messageHead_ = (messageHead_ + 1) % kMessages;
    ++messageCount_;
    return true;
  }
  bool message(const Text& text) { return serialPrint(text, true); }
  bool serialPrint(const Text& text, bool newline = true) {
    if (!text.valid()) { ++messageDrops_; return false; }
    return serialPrint(text.data(), newline);
  }
  template<class Value> bool serialPrint(const Value& value, bool newline = true) {
    return serialPrint(Text::from(value), newline);
  }
  bool message(double number) {
    if (!std::isfinite(number)) { ++messageDrops_; return false; }
    char text[32]{};
    const int written = std::snprintf(text, sizeof(text), "%.6g", number);
    if (written <= 0 || size_t(written) >= sizeof(text)) { ++messageDrops_; return false; }
    return message(text);
  }
  template<class Number, typename std::enable_if<std::is_arithmetic<Number>::value, int>::type = 0>
  bool message(Number number) { return message(static_cast<double>(number)); }
  bool popMessage(char* out, size_t capacity) {
    if (!out || !capacity || !messageCount_) return false;
    const auto* text = messages_[messageTail_];
    size_t n = 0;
    while (text[n] && n + 1 < capacity) { out[n] = text[n]; ++n; }
    out[n] = '\0';
    messageTail_ = (messageTail_ + 1) % kMessages;
    messageOffset_ = 0;
    --messageCount_;
    return true;
  }
  uint32_t messageDrops() const { return messageDrops_; }

 private:
  static constexpr size_t kMessages = 8, kMessageLength = 128;
  static uint8_t port(Motor motor) { return static_cast<uint8_t>(motor); }
  static int16_t normalizePower(double n) {
    return !std::isfinite(n) ? 0 : static_cast<int16_t>(n < -100 ? -100 : n > 100 ? 100 : n);
  }
  static float finitePercent(double n) { return std::isfinite(n) ? static_cast<float>(n / 100.0) : 0; }
  bool canCommand(Motor motor) const {
    return port(motor) < 4 && running() && robot_.motionAllowed();
  }
  bool validContext(const Context& ctx) const {
    return running() && ctx.scriptUid == mainUid_ && ctx.runGeneration == runGeneration();
  }
  void resetRun() {
    driveActive_ = driveTimed_ = false;
    clearEdges();
    messageHead_ = messageTail_ = messageCount_ = 0;
    messageOffset_ = 0;
    messageDrops_ = 0;
    arithmeticErrors_ = 0;
    ps4Requested_ = false;
  }
  void clearEdges() {
    for (auto& value : pressed_) value = 0;
    for (auto& value : released_) value = 0;
    ++edgeEpoch_;
    if (!edgeEpoch_) ++edgeEpoch_;
  }
  void updateDriveTimer(uint32_t now) {
    if (driveTimed_ && static_cast<int32_t>(now - driveDeadline_) >= 0) stopDrive();
  }
  void applyDrive() { if (driveActive_ && robot_.motionAllowed()) robot_.move(drive_[0], drive_[1], drive_[2]); }
  void serviceMessages() {
    // Bounded work; never flush or wait for a USB reader. Keep safety in update().
    for (unsigned budget = 0; budget < 32 && messageCount_; ++budget) {
      const char next = messages_[messageTail_][messageOffset_];
      if (!next && !messageNewline_[messageTail_]) {
        messageTail_ = (messageTail_ + 1) % kMessages; --messageCount_; messageOffset_ = 0; continue;
      }
      if (Serial.availableForWrite() <= 0) break;
      if (Serial.write(static_cast<uint8_t>(next ? next : '\n')) != 1) break;
      if (next) ++messageOffset_;
      else { messageTail_ = (messageTail_ + 1) % kMessages; --messageCount_; messageOffset_ = 0; }
    }
  }

  fast4wd::Robot robot_;
  fast4wd::SchedulerGate gate_;
  v2::Scheduler scheduler_;
  uint32_t mainUid_ = 0, driveDeadline_ = 0, motionEpoch_ = 0;
  uint64_t edgeEpoch_ = 1;
  uint64_t pressed_[17]{}, released_[17]{};
  Reset reset_ = nullptr;
  bool begun_ = false, started_ = false, ps4Requested_ = false, driveActive_ = false, driveTimed_ = false;
  float drive_[3]{};
  char messages_[kMessages][kMessageLength]{};
  bool messageNewline_[kMessages]{};
  size_t messageHead_ = 0, messageTail_ = 0, messageCount_ = 0;
  size_t messageOffset_ = 0;
  uint32_t messageDrops_ = 0;
  uint32_t randomState_ = 0x6d2b79f5U, arithmeticErrors_ = 0;
};

} }
