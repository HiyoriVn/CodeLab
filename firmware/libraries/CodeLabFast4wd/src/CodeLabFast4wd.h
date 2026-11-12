#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <CodeLabRobot.h>
#include <I2CReceiver.h>
#include "QuadMotors.h"
#include "CodeLabV2Scheduler.hpp"

#if !CONFIG_IDF_TARGET_ESP32S3
#error "CodeLabFast4wd requires ESP32-S3."
#endif

namespace codelab { namespace fast4wd {
struct MotorLayout {
  uint8_t wheelAtPort[4] = {0, 1, 2, 3};
  uint8_t reversed = 3;
  uint8_t enabled = 15;
};

class Robot : private robot::MotorInterface {
  enum class Drive { Idle, Ps4, Fixed };
  struct MotorCommand {
    bool active = false;
    float target = 0;
    uint32_t duration = 0, startedAt = 0;
  };
  static constexpr uint8_t ledPin = 47;
  QuadMotors motors_;
  const MotorLayout layout_;
  const float limit_;
  MotorCommand commands_[4];
  float applied_[4] = {};
  bool returning_[4] = {};
  uint32_t lastOutputAt_ = 0;
  robot::MockServo servo_;
  robot::RobotController controller_;
  robot::Ps4ControlMapping controls_;
  ps4i2c::Receiver receiver_;
  bool busReady_ = false, initialized_ = false, blink_ = false;
  bool armAfterClear_ = false, stopRequested_ = false;
  Drive drive_ = Drive::Idle;
  robot::Twist fixed_;
  uint32_t polledAt_ = 0, printedAt_ = 0;
  uint32_t previousButtons_ = 0, pressed_ = 0, released_ = 0;
  bool buttonsLinked_ = false;
  // Blockly policy is selected only by generated programs. Reference clients
  // retain the original controller policy and unchanged physical drivers.
  bool blockly_ = false, ps4Dependent_ = false, motorFault_ = false;
  bool blocklyTicked_ = false, linkSeen_ = false;
  uint32_t blocklyAt_ = 0, motionEpoch_ = 0, observedReport_ = 0;
  uint32_t inputButtons_ = 0x1fcffU; // excludes Options/Share as system controls
  uint8_t inputAxes_ = 7;
  enum class Recovery { NEUTRAL, ACTION, READY } recovery_ = Recovery::NEUTRAL;

  void updateBlocklyLink(uint32_t now) {
    if (!ps4Dependent_) return;
    const auto input = receiver_.snapshot(now);
    if (!busReady_ || !input.connected) {
      if (linkSeen_) { ++motionEpoch_; disable(); }
      linkSeen_ = false;
      recovery_ = Recovery::NEUTRAL;
      return;
    }
    linkSeen_ = true;
    if (receiver_.advances == observedReport_) return;
    observedReport_ = receiver_.advances;
    const int16_t axes[] = {input.lx,input.ly,input.rx,input.ry};
    bool neutral = (input.buttons & inputButtons_) == 0;
    for (unsigned i=0;i<4;++i) if ((inputAxes_ & (1U<<i)) && abs(axes[i]) > 60) neutral = false;
    if (recovery_ == Recovery::NEUTRAL && neutral) recovery_ = Recovery::ACTION;
    else if (recovery_ == Recovery::ACTION && !neutral) recovery_ = Recovery::READY;
  }

  void endBlocklyLoop(uint32_t now) {
    if (!canCommand()) { disable(); return; }
    float mixed[4] = {};
    if (drive_ != Drive::Idle) {
      robot::Twist intent = fixed_;
      if (drive_ == Drive::Ps4) {
        const auto input = receiver_.snapshot(now);
        const auto axis = [](int value) { const float x=value/1000.0f,a=fabsf(x); return a<=0.06f?0.0f:(x<0?-1:1)*(a-0.06f)/0.94f; };
        // The legacy PS4 macro retains its axis convention and turn priority.
        intent = {abs(input.lx)>100?0.0f:axis(input.ly), axis(input.rx), abs(input.lx)>100?axis(input.lx):0.0f};
      }
      if (!robot::MecanumMixer::mix(intent, config(limit_,layout_).mixer, mixed)) { motorFault_=true; disable(); return; }
    }
    bool requested = drive_ != Drive::Idle;
    for (const auto& command:commands_) requested = requested || command.active;
    if (!requested) return; // Boot never permits PWM without a student command.
    if (!motors_.permitted() && !motors_.permit(now)) { motorFault_=true; disable(); return; }
    motors_.renew(now);
    if (!write(mixed)) { motorFault_=true; disable(); }
  }

  static robot::ControlConfig config(float limit, const MotorLayout& layout) {
    robot::ControlConfig c;
    c.mixer.speedLimit = limit;
    c.accelerationPerSecond = 12.0f;
    c.deadzone = 0.06f;
    for (unsigned port = 0; port < 4; ++port) {
      c.mixer.wheelAtOutput[port] = layout.wheelAtPort[port];
      c.mixer.inverted[port] = (layout.reversed & (1U << port)) != 0;
    }
    c.servo.minimum = 45;
    c.servo.maximum = 135;
    c.servo.initial = 90;
    c.servo.rateDegPerSecond = 30;
    return c;
  }

  bool motorEnabled(unsigned port) const { return port < 4 && (layout_.enabled & (1U << port)); }
  bool ready() const override { return motors_.ready(); }
  void disable() override {
    motors_.disable();
    for (unsigned port = 0; port < 4; ++port) {
      commands_[port] = {};
      applied_[port] = 0;
      returning_[port] = false;
    }
  }

  bool write(const float (&mixed)[4]) override {
    const uint32_t now = millis();
    const uint32_t elapsed = now - lastOutputAt_;
    lastOutputAt_ = now;
    const float ramp = 0.012f * (elapsed < 50 ? elapsed : 50);
    float output[4];
    for (unsigned port = 0; port < 4; ++port) {
      auto& command = commands_[port];
      if (command.duration && uint32_t(now - command.startedAt) >= command.duration) {
        command = {true, 0, 0, 0};
      }
      output[port] = mixed[port];
      if (!motorEnabled(port) || (command.active && command.target == 0)) output[port] = 0;
      else if (command.active || returning_[port]) {
        const float target = command.active ? command.target : mixed[port];
        const float delta = target - applied_[port];
        output[port] = fabsf(delta) <= ramp ? target : applied_[port] + robot::clamp(delta, -ramp, ramp);
        if (!command.active && output[port] == target) returning_[port] = false;
      }
    }
    if (!motors_.write(output)) return false;
    for (unsigned port = 0; port < 4; ++port) applied_[port] = output[port];
    return true;
  }

  void sampleButtons(uint32_t now) {
    const auto input = receiver_.snapshot(now);
    pressed_ = released_ = 0;
    if (input.connected && buttonsLinked_) {
      pressed_ = input.buttons & ~previousButtons_;
      released_ = previousButtons_ & ~input.buttons;
    }
    buttonsLinked_ = input.connected;
    previousButtons_ = input.buttons;
  }

  bool canCommand() const {
    if (blockly_) return initialized_ && motors_.ready() && !motorFault_ && !stopRequested_ &&
      (!ps4Dependent_ || (connected() && recovery_ == Recovery::READY));
    return controller_.state() == robot::State::ARMED && motors_.permitted() &&
      connected() && !stopRequested_ && !button(8);
  }

  void poll(uint32_t now) {
    receiver_.watchdog(now);
    if (!busReady_ || uint32_t(now - polledAt_) < 6) return;
    polledAt_ = now;
    const size_t count = Wire.requestFrom(uint8_t(0x30), ps4i2c::frameSize);
    uint8_t bytes[ps4i2c::frameSize];
    size_t received = 0;
    while (Wire.available() && received < sizeof(bytes)) bytes[received++] = uint8_t(Wire.read());
    receiver_.ingest(bytes, count == sizeof(bytes) ? received : 0, millis());
  }

  static const char* stateName(robot::State state) {
    if (state == robot::State::ARMED) return "ARMED";
    if (state == robot::State::FAULT) return "FAULT";
    return "DISARMED";
  }

 public:
  void configureBlockly(bool ps4Dependent, uint32_t buttons = 0x1fcffU, uint8_t axes = 7) {
    blockly_ = true; ps4Dependent_ = ps4Dependent;
    inputButtons_ = buttons; inputAxes_ = axes;
  }
  void requirePs4() {
    if (!ps4Dependent_) { ps4Dependent_=true; recovery_=Recovery::NEUTRAL; ++motionEpoch_; disable(); }
  }
  bool motionAllowed() const { return canCommand(); }
  uint32_t motionEpoch() const { return motionEpoch_; }
  void haltMotorOutputs() { if (blockly_) { disable(); drive_=Drive::Idle; fixed_={}; } stopRequested_=true; }
  explicit Robot(uint8_t speedPercent = 100, MotorLayout layout = {}) :
    layout_(layout), limit_(robot::clamp(speedPercent, 1, 100) / 100.0f),
    controller_(*this, servo_, config(limit_, layout_)) {}
  Robot(const Robot&) = delete;
  Robot& operator=(const Robot&) = delete;

  void begin(bool blinkOnLoss) {
    if (initialized_) return;
    blink_ = blinkOnLoss;
    if (blink_) {
      pinMode(ledPin, OUTPUT);
      digitalWrite(ledPin, LOW);
    }
    delay(300);
    busReady_ = Wire.begin(8, 9, uint32_t(100000));
    Wire.setTimeOut(20);
    initialized_ = true;
    const bool motorReady = motors_.begin();
    if (blockly_) Serial.printf("Blockly I2C=%u MCPWM=%u. Program starts at boot.\n", unsigned(busReady_), unsigned(motorReady));
    else Serial.printf("4WD I2C=%u MCPWM=%u. Options=ARM, Share=STOP.\n", unsigned(busReady_), unsigned(motorReady));
  }

  void beginLoop() {
    drive_ = Drive::Idle;
    stopRequested_ = false;
    if (!initialized_) return;
    const uint32_t now = millis();
    if (blockly_ && blocklyTicked_ && uint32_t(now-blocklyAt_) > 250) { motorFault_=true; disable(); }
    motors_.expire(now);
    poll(now);
    sampleButtons(millis());
    if (blockly_) updateBlocklyLink(millis());
  }

  bool connected() const { return busReady_ && receiver_.snapshot(millis()).connected; }
  bool controllerArmed() const { return controller_.state() == robot::State::ARMED; }
  float axis(unsigned index) const {
    const auto input = receiver_.snapshot(millis());
    const int16_t axes[] = {input.lx, input.ly, input.rx, input.ry};
    return index < 4 ? axes[index] / 10.0f : 0;
  }
  bool button(unsigned bit) const {
    return bit < 17 && (receiver_.snapshot(millis()).buttons & (1UL << bit));
  }
  bool buttonEdge(unsigned bit, bool press) const {
    return connected() && bit < 17 && ((press ? pressed_ : released_) & (1UL << bit));
  }
  void driveFromPs4() { drive_ = Drive::Ps4; }
  void move(float forward, float left, float counterclockwise) {
    if (!isfinite(forward) || !isfinite(left) || !isfinite(counterclockwise)) { stop(); return; }
    drive_ = Drive::Fixed;
    fixed_ = {forward, left, counterclockwise};
  }
  void movePercent(float forward, float left, float counterclockwise) {
    move(forward / 100.0f, left / 100.0f, counterclockwise / 100.0f);
  }
  void stop() { haltMotorOutputs(); }

  bool spin(unsigned port, float percent, bool reverse) {
    if (!motorEnabled(port) || !canCommand()) return false;
    if (!isfinite(percent)) { stop(); return false; }
    const float duty = robot::clamp(percent, 0, limit_ * 100) / 100.0f;
    const bool inverted = (layout_.reversed & (1U << port)) != 0;
    if (blockly_ && !motors_.permitted() && !motors_.permit(millis())) { motorFault_=true; disable(); return false; }
    commands_[port] = {true, inverted != reverse ? -duty : duty, 0, 0};
    return true;
  }
  bool spinFor(unsigned port, float percent, bool reverse, uint32_t duration) {
    if (duration < 1 || duration > 5000 || !spin(port, percent, reverse)) return false;
    commands_[port].duration = duration;
    commands_[port].startedAt = millis();
    return true;
  }
  void stopMotor(unsigned port) {
    if (motorEnabled(port) && canCommand()) commands_[port] = {true, 0, 0, 0};
  }
  void releaseMotor(unsigned port) {
    if (motorEnabled(port) && canCommand() && commands_[port].active) {
      commands_[port] = {};
      returning_[port] = true;
    }
  }
  float motorPwm(unsigned port) const {
    if (!motorEnabled(port) || !motors_.permitted()) return 0;
    const int duty[] = {motors_.m1FI() - motors_.m1BI(), motors_.m2FI() - motors_.m2BI(),
      motors_.m3FI() - motors_.m3BI(), motors_.m4FI() - motors_.m4BI()};
    return duty[port] * (100.0f / 255) * ((layout_.reversed & (1U << port)) ? -1 : 1);
  }
  bool waitForMotor(unsigned port) {
    if (!motorEnabled(port) || !commands_[port].duration) return false;
    endLoop();
    while (canCommand() && commands_[port].duration) {
      beginLoop();
      endLoop();
    }
    const bool completed = canCommand();
    // Freshness can expire during endLoop's yield, before the next tick.
    if (!completed && controller_.state() == robot::State::ARMED) endLoop();
    pressed_ = released_ = 0;
    return completed;
  }

  void endLoop() {
    if (initialized_) {
      const uint32_t now = millis();
      receiver_.watchdog(now);
      auto input = receiver_.snapshot(now);
      const bool fresh = busReady_ && input.connected;
      if (blink_) digitalWrite(ledPin, fresh || ((now / 250U) % 2U == 0U) ? HIGH : LOW);
      if (blockly_) {
        updateBlocklyLink(now);
        endBlocklyLoop(now);
        blocklyAt_=now; blocklyTicked_=true;
        delay(2);
        return;
      }

      // Preserve fast100's left-stick turn priority over forward motion.
      const int16_t turn = input.lx;
      input.lx = input.rx;
      input.rx = 0;
      input.ry = 0;
      if (abs(turn) > 100) {
        input.rx = turn;
        input.ly = 0;
      }

      auto request = controls_.requests(input, now);
      request.disarm = request.disarm || stopRequested_ || button(8);
      if (request.disarm) request.arm = request.clearFault = false;
      const bool neutral = abs(input.lx) <= 80 && abs(input.ly) <= 80 && abs(input.rx) <= 80 &&
        (input.buttons & ((1UL << 13) | (1UL << 14))) == 0;
      if (armAfterClear_ && controller_.state() == robot::State::DISARMED && fresh && neutral && !request.disarm) {
        request.arm = true;
      }
      const bool clearLinkWithOptions = request.arm && controller_.state() == robot::State::FAULT &&
        controller_.fault() == robot::Fault::LINK && fresh && neutral && motors_.ready();
      if (clearLinkWithOptions) {
        request.arm = false;
        request.clearFault = true;
      }

      if (!busReady_ || receiver_.timedOut(now)) controller_.linkFault();
      const auto previous = controller_.state();
      if (previous == robot::State::ARMED && drive_ != Drive::Ps4) {
        const robot::Twist intent = drive_ == Drive::Fixed ? fixed_ : robot::Twist{};
        input.ly = int16_t(robot::clamp(intent.vx, -1, 1) * 1000);
        input.lx = int16_t(robot::clamp(intent.vy, -1, 1) * 1000);
        input.rx = int16_t(robot::clamp(intent.omega, -1, 1) * 1000);
      }
      controller_.tick(input, now, request, false);
      armAfterClear_ = clearLinkWithOptions && controller_.state() == robot::State::DISARMED;
      if (previous != robot::State::ARMED && controller_.state() == robot::State::ARMED &&
          (!fresh || !motors_.permit(now))) controller_.linkFault();
      if (previous != robot::State::ARMED) lastOutputAt_ = now;
      if (controller_.state() == robot::State::ARMED && fresh) motors_.renew(now);

      if (uint32_t(now - printedAt_) >= 1000) {
        printedAt_ = now;
        Serial.printf("4WD connected=%u state=%s fault=%u EN=%u fresh=%lu errors=%lu\n",
          unsigned(fresh), stateName(controller_.state()), unsigned(controller_.fault()), unsigned(motors_.permitted()),
          (unsigned long)receiver_.advances, (unsigned long)receiver_.errors);
      }
    }
    delay(2);
  }
};
} }
