#pragma once
#include <CodeLabRobot.h>

namespace demo {
struct Rz7899Duty { uint8_t fi=0,bi=0; };
// Manufacturer truth table: FI/BI 10=forward,01=reverse,00=coast,11=brake.
// PWM active input, inactive input LOW. Stop uses coast, not an unreviewed brake.
inline bool rz7899Plan(float signedSpeed,Rz7899Duty& out) {
  out={};
  if(!isfinite(signedSpeed)) return false;
  const float limited=codelab::robot::clamp(signedSpeed,-0.15f,0.15f);
  const auto duty=static_cast<uint8_t>(fabsf(limited)*255+0.5f);
  if(limited>0) out.fi=duty;
  else if(limited<0) out.bi=duty;
  return true;
}
// This is a driver command-plan/mock backend, NEVER a GPIO implementation.
// Source map M1 35/36, M2 37/38 conflicts with Octal memory; no bypass provided.
struct OnboardMotorPlan : codelab::robot::MockMotors {
  Rz7899Duty duty[4]={};
  bool write(const float (&values)[4]) override {
    Rz7899Duty next[4];
    for(unsigned i=0;i<4;++i) if(!rz7899Plan(values[i],next[i])) { disable();return false; }
    if(!MockMotors::write(values)) { disable();return false; }
    for(unsigned i=0;i<4;++i) duty[i]=next[i];
    return true;
  }
  void disable() override { MockMotors::disable();for(auto& d:duty) d={}; }
};
}
