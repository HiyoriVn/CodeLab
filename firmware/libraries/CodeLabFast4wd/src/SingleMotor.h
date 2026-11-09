#pragma once
#include <CodeLabRobot.h>

// fast100 mapping. Use only after the dedicated runtime's board checks.
namespace codelab { namespace motor_test {
struct PwmIo {
  virtual ~PwmIo() = default;
  virtual bool begin(uint8_t fi, uint8_t bi) = 0;
  virtual bool apply(uint8_t fi, uint8_t bi) = 0;
  virtual void emergencyLow() = 0;
};

template<unsigned Channel> class SingleMotor final : public robot::MotorInterface {
  static_assert(Channel >= 1 && Channel <= 4, "Invalid motor channel");
  PwmIo& io_;
  bool ready_ = false, permitted_ = false;
  uint32_t permittedAt_ = 0, now_ = 0, activeAt_ = 0;
  bool activeStarted_ = false;
 public:
  static constexpr uint8_t fiPin = 33 + Channel * 2;
  static constexpr uint8_t biPin = 34 + Channel * 2;
  static constexpr unsigned slot = Channel - 1; // FL, FR, RL, RR
  float requested[4] = {};
  uint8_t fiDuty = 0, biDuty = 0;
  explicit SingleMotor(PwmIo& io) : io_(io) {}
  bool begin() {
    permitted_ = false;
    ready_ = io_.begin(fiPin, biPin);
    if (!ready_) io_.emergencyLow();
    return ready_;
  }
  bool ready() const override { return ready_; }
  static constexpr uint32_t testWindowMs = 15000;
  static constexpr uint32_t activeWindowMs = 2000;
  bool permit(uint32_t now) { if (!ready_ || permitted_) return false; permittedAt_ = now; now_ = now; activeStarted_ = false; permitted_ = true; return true; }
  void expire(uint32_t now) {
    now_ = now;
    if (permitted_ && (uint32_t(now - permittedAt_) >= testWindowMs ||
        (activeStarted_ && uint32_t(now - activeAt_) >= activeWindowMs))) disable();
  }
  bool permitted() const { return permitted_; }

  void renew(uint32_t now) {
    if (!permitted_) return;
    permittedAt_ = now;
    if (activeStarted_) activeAt_ = now;
  }
  bool write(const float (&values)[4]) override {
    if (!ready_) return false;
    for (float value : values) if (!isfinite(value)) { disable(); return false; }
    for (unsigned i=0; i<4; ++i) requested[i]=values[i];
    const float speed = permitted_ ? robot::clamp(values[slot], -1.0f, 1.0f) : 0;
    const uint8_t duty = static_cast<uint8_t>(fabsf(speed)*255.0f);
    // Both inputs LOW before applying either direction, including reversals.
    if (!io_.apply(0,0) || (duty && !io_.apply(speed>0 ? duty : 0, speed<0 ? duty : 0))) {
      ready_=false; permitted_=false; fiDuty=biDuty=0; io_.emergencyLow(); return false;
    }
    fiDuty=speed>0?duty:0; biDuty=speed<0?duty:0;
    if (duty && !activeStarted_) { activeAt_=now_; activeStarted_=true; }
    return true;
  }
  void disable() override {
    permitted_=false; activeStarted_=false; fiDuty=biDuty=0;
    for (auto& value : requested) value=0;
    if (ready_ && !io_.apply(0,0)) { ready_=false; io_.emergencyLow(); }
  }
};
} }



