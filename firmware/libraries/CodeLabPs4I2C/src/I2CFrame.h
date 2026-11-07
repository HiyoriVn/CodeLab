#pragma once
#include <stdint.h>
#include <stddef.h>
#include "MappingPublisher.h"

namespace codelab { namespace ps4i2c {
constexpr size_t frameSize=13;
constexpr uint32_t timeoutMs=250;
struct Frame {
  bool connected=false; uint8_t sequence=0;
  int16_t axes[4]={}; uint32_t buttons=0;
};
inline void encode(const Frame& f,uint8_t (&bytes)[frameSize]) {
  bytes[0]=uint8_t((f.sequence&127U)<<1)|(f.connected?1U:0U);
  for(unsigned i=0;i<4;++i) {
    const uint16_t axis=f.connected?uint16_t(f.axes[i]):0;
    bytes[1+2*i]=uint8_t(axis);bytes[2+2*i]=uint8_t(axis>>8);
  }
  const uint32_t buttons=f.connected?f.buttons:0;
  for(unsigned i=0;i<4;++i) bytes[9+i]=uint8_t(buttons>>(8*i));
}
inline bool decode(const uint8_t* bytes,size_t count,Frame& out) {
  out={}; if(!bytes||count!=frameSize) return false;
  out.connected=(bytes[0]&1)!=0;out.sequence=bytes[0]>>1;
  if(!out.connected) return true;
  for(unsigned i=0;i<4;++i) {
    const uint16_t word=uint16_t(bytes[1+2*i])|(uint16_t(bytes[2+2*i])<<8);
    out.axes[i]=int16_t(word>=32768U?int32_t(word)-65536:int32_t(word));
  }
  for(unsigned i=0;i<4;++i) out.buttons|=uint32_t(bytes[9+i])<<(8*i);
  return true;
}
inline bool samePayload(const Frame& a,const Frame& b) {
  if(a.connected!=b.connected||a.buttons!=b.buttons) return false;
  for(unsigned i=0;i<4;++i) if(a.axes[i]!=b.axes[i]) return false;
  return true;
}
class Publisher {
  Frame frame_; bool active_=false; uint32_t reportAt_=0;
 public:
  void invalidate() { active_=false; }
  uint32_t reportAt() const { return reportAt_; }
  // Called once per loop, never from onRequest. Fresh means actual BT report evidence.
  void update(bool connected,bool fresh,const ps4bridge::Input& input,uint32_t now) {
    if(!connected) { invalidate();return; }
    if(fresh) {
      ps4bridge::Frame mapped;
      if(!ps4bridge::mapInput(input,mapped)) { invalidate();return; }
      frame_.sequence=uint8_t((frame_.sequence+1)&127U);
      for(unsigned i=0;i<4;++i) frame_.axes[i]=mapped.axes[i];
      frame_.buttons=mapped.buttons; reportAt_=now;active_=true;
    }
    if(active_&&uint32_t(now-reportAt_)>timeoutMs) invalidate();
  }
  void bytes(uint32_t now,uint8_t (&out)[frameSize]) const {
    Frame frame=frame_;frame.connected=active_&&uint32_t(now-reportAt_)<=timeoutMs;
    encode(frame,out); // Never increments sequence on poll, disconnect or timeout.
  }
};
} }
