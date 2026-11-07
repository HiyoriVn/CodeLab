#pragma once
#include "I2CFrame.h"
#include <RobotController.h>

namespace codelab { namespace ps4i2c {
class Receiver {
  Frame baseline_,accepted_;
  bool baselineSeen_=false,fresh_=false,expired_=false,everAccepted_=false;
  uint32_t startedAt_=0,lastAdvanceAt_=0;
 public:
  uint32_t advances=0,repeats=0,errors=0,resyncs=0;
  explicit Receiver(uint32_t startedAt=0):startedAt_(startedAt) {}
  uint8_t sequence() const { return baseline_.sequence; }
  void watchdog(uint32_t now) {
    const bool expired=timedOut(now);
    if(expired&&!expired_) {
      fresh_=false;baselineSeen_=false; // First post-gap frame is baseline only.
    }
    expired_=expired;
  }
  bool ingest(const uint8_t* data,size_t count,uint32_t now) {
    watchdog(now);Frame frame;
    if(!decode(data,count,frame)) { fresh_=false;++errors;return false; }
    if(!frame.connected) {
      fresh_=false;baseline_=frame;baselineSeen_=true;return false;
    }
    if(!baselineSeen_) { baseline_=frame;baselineSeen_=true;++resyncs;return false; }
    const uint8_t delta=uint8_t((frame.sequence-baseline_.sequence)&127U);
    if(delta==0) {
      ++repeats;
      if(!samePayload(frame,baseline_)) { fresh_=false;++errors; }
      return false; // Cached poll cannot restore or refresh freshness.
    }
    if(delta>=64) { baseline_=frame;fresh_=false;++resyncs;return false; }
    baseline_=accepted_=frame;fresh_=everAccepted_=true;expired_=false;lastAdvanceAt_=now;++advances;return true;
  }
  bool timedOut(uint32_t now) const {
    return uint32_t(now-(everAccepted_?lastAdvanceAt_:startedAt_))>timeoutMs;
  }
  robot::Input snapshot(uint32_t now) const {
    robot::Input out;out.hasReport=everAccepted_;out.reportAt=lastAdvanceAt_;
    out.connected=fresh_&&!timedOut(now);
    if(!out.connected) return out;
    int16_t values[4];
    for(unsigned i=0;i<4;++i) values[i]=int16_t((int32_t(accepted_.axes[i])+32768)*2000/65535-1000);
    out.lx=values[0];out.ly=values[1];out.rx=values[2];out.ry=values[3];out.buttons=accepted_.buttons;
    return out;
  }
};
} }
