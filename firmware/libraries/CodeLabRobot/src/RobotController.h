#pragma once
#include "Actuators.h"

namespace codelab { namespace robot {
struct Input {
  bool hasReport=false,connected=false;
  uint32_t reportAt=0;
  int16_t lx=0,ly=0,rx=0,ry=0; // parser-normalized -1000..1000, unchanged
  uint32_t buttons=0;
};
struct Requests { bool arm=false,disarm=false,clearFault=false,enableServo=false; };
enum class State { DISARMED, ARMED, FAULT };
enum class Fault { NONE, CONFIG, LINK, INVALID_INPUT, BACKEND, LOOP_STALL, SERVO_POWER };
struct ControlConfig {
  MixerConfig mixer;
  ServoConfig servo;
  float deadzone=0.08f, accelerationPerSecond=1.0f;
  uint32_t maxRampStepMs=50;
  bool valid() const {
    return mixer.valid()&&servo.valid()&&isfinite(deadzone)&&deadzone>=0&&deadzone<1
      &&isfinite(accelerationPerSecond)&&accelerationPerSecond>0
      &&maxRampStepMs>0&&maxRampStepMs<=250;
  }
};
class RobotController {
  MotorInterface& motors_; ServoController servo_; ControlConfig config_;
  State state_=State::DISARMED; Fault fault_=Fault::NONE;
  float wheels_[4]={}; uint32_t lastTick_=0; bool ticked_=false;
  void stop() { for(auto& x:wheels_) x=0; motors_.disable(); servo_.disable(); }
  void fail(Fault why) { state_=State::FAULT; fault_=why; stop(); }
  float axis(int value) const {
    const float x=value/1000.0f,a=fabsf(x);
    return a<=config_.deadzone?0:(x<0?-1:1)*(a-config_.deadzone)/(1-config_.deadzone);
  }
 public:
  static constexpr uint32_t watchdogMs=250;
  RobotController(MotorInterface& motors, ServoInterface& servo, ControlConfig config={}):
    motors_(motors),servo_(servo,config.servo),config_(config) {
    stop(); if(!config_.valid()) fail(Fault::CONFIG);
  }
  void tick(const Input& in, uint32_t now, Requests request={}, bool servoPowerConfirmed=false) {
    const uint32_t elapsed=ticked_?uint32_t(now-lastTick_):0;
    ticked_=true; lastTick_=now;
    const bool fresh=in.hasReport&&in.connected&&uint32_t(now-in.reportAt)<=watchdogMs;
    const bool valid=in.lx>=-1000&&in.lx<=1000&&in.ly>=-1000&&in.ly<=1000
      &&in.rx>=-1000&&in.rx<=1000&&in.ry>=-1000&&in.ry<=1000;
    if(!config_.valid()) { fail(Fault::CONFIG); return; }
    if(!valid) { fail(Fault::INVALID_INPUT); return; }
    if(!fresh) {
      if(state_==State::ARMED) fail(Fault::LINK); else stop();
      return;
    }
    const Twist target={axis(in.ly),axis(in.lx),axis(in.rx)}; // no second Y inversion
    const bool up=(in.buttons&(1UL<<13))!=0,down=(in.buttons&(1UL<<14))!=0;
    const bool neutral=target.vx==0&&target.vy==0&&target.omega==0&&!up&&!down;
    if(state_==State::ARMED&&elapsed>watchdogMs) { fail(Fault::LOOP_STALL); return; }
    if(request.disarm) {
      if(state_!=State::FAULT) { state_=State::DISARMED; fault_=Fault::NONE; }
      stop(); return;
    }
    if(state_==State::FAULT) {
      stop();
      if(request.clearFault&&neutral&&motors_.ready()) { state_=State::DISARMED; fault_=Fault::NONE; }
      return; // clearing a fault never arms in the same tick
    }
    if(state_==State::DISARMED) {
      stop();
      if(request.arm&&neutral&&motors_.ready()) state_=State::ARMED;
      return; // no command emitted on the arm transition
    }
    if((request.enableServo||servo_.enabled())&&!servoPowerConfirmed) { fail(Fault::SERVO_POWER); return; }
    if(!motors_.ready()) { fail(Fault::BACKEND); return; }
    const float dt=float(elapsed<config_.maxRampStepMs?elapsed:config_.maxRampStepMs)/1000;
    float desired[4];
    if(!MecanumMixer::mix(target,config_.mixer,desired)) { fail(Fault::INVALID_INPUT); return; }
    const float step=config_.accelerationPerSecond*dt;
    for(unsigned i=0;i<4;++i) wheels_[i]+=clamp(desired[i]-wheels_[i],-step,step);
    if(request.enableServo&&!servo_.enable(true,servoPowerConfirmed)) { fail(Fault::BACKEND); return; }
    if(!servo_.step(up,down,dt,servoPowerConfirmed)) { fail(Fault::BACKEND); return; }
    if(!motors_.write(wheels_)) fail(Fault::BACKEND);
  }
  State state() const { return state_; }
  // Transport may latch a timeout even while DISARMED (e.g. I2C polling a dead slave).
  void linkFault() { fail(Fault::LINK); }
  Fault fault() const { return fault_; }
  const ServoController& servo() const { return servo_; }
};
} }
