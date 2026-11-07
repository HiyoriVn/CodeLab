#pragma once
#include "MecanumMixer.h"

namespace codelab { namespace robot {
struct MotorInterface {
  virtual ~MotorInterface() = default;
  virtual bool ready() const = 0;
  virtual bool write(const float (&speeds)[4]) = 0;
  virtual void disable() = 0;
};
struct ServoInterface {
  virtual ~ServoInterface() = default;
  virtual bool ready() const = 0;
  virtual bool write(float degrees) = 0;
  virtual void disable() = 0;
};
// These backends store logical values only. No Arduino/GPIO/LEDC/servo dependency.
struct MockMotors : MotorInterface {
  float speeds[4]={}; bool enabled=false, available=true;
  bool ready() const override { return available; }
  bool write(const float (&values)[4]) override {
    if(!available) return false;
    for(unsigned i=0;i<4;++i) speeds[i]=values[i];
    enabled=true; return true;
  }
  void disable() override { for(auto& x:speeds) x=0; enabled=false; }
};
struct MockServo : ServoInterface {
  float degrees=0; bool enabled=false, available=true;
  bool ready() const override { return available; }
  bool write(float value) override {
    if(!available) return false;
    degrees=value; enabled=true; return true;
  }
  void disable() override { enabled=false; }
};
struct ServoConfig {
  float minimum=0,maximum=180,initial=90,rateDegPerSecond=45;
  bool valid() const {
    return isfinite(minimum)&&isfinite(maximum)&&isfinite(initial)&&isfinite(rateDegPerSecond)
      &&minimum>=0&&maximum<=180&&minimum<=maximum&&initial>=minimum&&initial<=maximum
      &&rateDegPerSecond>0;
  }
};
class ServoController {
  ServoInterface& sink_; ServoConfig config_; float angle_; bool enabled_=false;
 public:
  ServoController(ServoInterface& sink, ServoConfig config):sink_(sink),config_(config),angle_(config.initial) {}
  void disable() { enabled_=false; sink_.disable(); }
  bool enable(bool explicitRequest, bool powerConfirmed) {
    if(!explicitRequest||!powerConfirmed||!config_.valid()||!sink_.ready()) return false;
    enabled_=sink_.write(angle_); return enabled_;
  }
  bool step(bool up, bool down, float seconds, bool powerConfirmed) {
    if(!powerConfirmed) { disable(); return true; }
    if(!enabled_) return true;
    if(!sink_.ready()||!isfinite(seconds)||seconds<0) { disable(); return false; }
    if(up==down) return true;
    angle_=clamp(angle_+(up?1:-1)*config_.rateDegPerSecond*seconds,config_.minimum,config_.maximum);
    if(!sink_.write(angle_)) { disable(); return false; }
    return true;
  }
  bool enabled() const { return enabled_; }
  float angle() const { return angle_; }
};
} }
