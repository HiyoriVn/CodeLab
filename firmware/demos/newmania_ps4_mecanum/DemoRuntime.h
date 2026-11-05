#pragma once
#include <string.h>
#include <CodeLabRobot.h>
#include "Rz7899Plan.h"

namespace demo {
using namespace codelab::robot;
inline ControlConfig lowSpeedConfig() {
  ControlConfig c; c.mixer.speedLimit=0.15f; c.accelerationPerSecond=0.5f;
  c.servo.minimum=45; c.servo.maximum=135; c.servo.initial=90; c.servo.rateDegPerSecond=30;
  return c; // Logical test limits, NOT physical driver/servo calibration.
}
enum class CommandResult { OK, BLOCKED, UNKNOWN };
class Runtime {
  OnboardMotorPlan motors_; MockServo servo_;
  RobotController controller_;
  Ps4ControlMapping buttons_;
  bool simulation_=false,servoSimulationPower_=false;
  Requests pending_;
 public:
  Runtime():controller_(motors_,servo_,lowSpeedConfig()) {
    motors_.available=false; servo_.available=false;
  }
  CommandResult command(const char* text) {
    if(strcmp(text,"STATUS")==0||strcmp(text,"HELP")==0) return CommandResult::OK;
    if(strcmp(text,"SIM_ON")==0||strcmp(text,"SIM_OFF")==0) {
      motors_.disable(); servo_.disable();
      simulation_=strcmp(text,"SIM_ON")==0; servoSimulationPower_=false;
      motors_.available=simulation_; servo_.available=simulation_;
      pending_.disarm=true; return CommandResult::OK;
    }
    if(strcmp(text,"DISARM")==0) { motors_.disable();servo_.disable();pending_.disarm=true;return CommandResult::OK; }
    if(strcmp(text,"CLEAR")==0) { pending_.clearFault=true;return CommandResult::OK; }
    if(strcmp(text,"SERVO_SIM_ENABLE")==0) {
      if(!simulation_||controller_.state()!=State::ARMED) return CommandResult::BLOCKED;
      // Permission for a MOCK ONLY; this is never a physical power-good condition.
      servoSimulationPower_=true; pending_.enableServo=true;return CommandResult::OK;
    }
    if(strncmp(text,"MOTOR",5)==0||strncmp(text,"SERVO",5)==0||strcmp(text,"ARM")==0)
      return CommandResult::BLOCKED;
    return CommandResult::UNKNOWN;
  }
  void tick(const Input& input,uint32_t now) {
    auto request=buttons_.requests(input,now);
    request.disarm=request.disarm||pending_.disarm;
    request.clearFault=request.clearFault||pending_.clearFault;
    request.enableServo=pending_.enableServo&&simulation_;
    controller_.tick(input,now,request,simulation_&&servoSimulationPower_);
    pending_={};
    if(controller_.state()!=State::ARMED) servoSimulationPower_=false;
  }
  bool simulation() const { return simulation_; }
  const RobotController& controller() const { return controller_; }
  const OnboardMotorPlan& motors() const { return motors_; }
  const MockServo& servo() const { return servo_; }
};
}
