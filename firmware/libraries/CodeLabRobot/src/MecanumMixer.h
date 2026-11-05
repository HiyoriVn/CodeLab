#pragma once
#include <stdint.h>
#include <math.h>

namespace codelab { namespace robot {
inline float clamp(float x, float lo, float hi) { return x<lo?lo:(x>hi?hi:x); }
struct Twist { float vx=0, vy=0, omega=0; };
// Logical wheel order FL, FR, RL, RR. +vx forward, +vy left, +omega CCW.
struct MixerConfig {
  uint8_t wheelAtOutput[4]={0,1,2,3};
  bool inverted[4]={false,false,false,false}; // per output slot
  float speedLimit=0.5f;
  bool valid() const {
    if (!isfinite(speedLimit)||speedLimit<0||speedLimit>1) return false;
    unsigned used=0;
    for (auto wheel:wheelAtOutput) {
      if (wheel>3||(used&(1U<<wheel))) return false;
      used|=1U<<wheel;
    }
    return true;
  }
};
class MecanumMixer {
 public:
  static bool mix(const Twist& t, const MixerConfig& config, float (&output)[4]) {
    for(auto& x:output) x=0;
    if (!config.valid()||!isfinite(t.vx)||!isfinite(t.vy)||!isfinite(t.omega)) return false;
    // Scale first to avoid overflow for finite, unusually large requests.
    const float scale=fmaxf(1,fmaxf(fabsf(t.vx),fmaxf(fabsf(t.vy),fabsf(t.omega))));
    const float x=t.vx/scale,y=t.vy/scale,w=t.omega/scale;
    const float wheels[4]={x-y-w,x+y+w,x+y-w,x-y+w};
    float peak=1/scale;
    for(float value:wheels) peak=fmaxf(peak,fabsf(value));
    for(unsigned slot=0;slot<4;++slot)
      output[slot]=wheels[config.wheelAtOutput[slot]]/peak*config.speedLimit*(config.inverted[slot]?-1:1);
    return true;
  }
};
} }
