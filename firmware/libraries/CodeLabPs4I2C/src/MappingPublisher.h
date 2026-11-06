// Derived from firmware/ps4_bridge/MappingPublisher.h by tools/i2c-demo-headers.mjs; do not edit.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
namespace codelab { namespace ps4bridge {
struct Input { int16_t lx=0,ly=0,rx=0,ry=0; uint32_t buttons=0; };
struct Frame { bool connected=false; int16_t axes[4]={}; uint32_t buttons=0; };
// Choose ceil in the inverse Arduino map so every integer percentage round-trips exactly.
inline int16_t axis(int16_t percent) {
  if (percent==0) return 0;
  const int32_t target=percent*10;
  return (int16_t)(((target+1000)*65535+1999)/2000-32768);
}
inline bool mapInput(const Input& in, Frame& out) {
  const int16_t values[]={in.lx,in.ly,in.rx,in.ry};
  out=Frame{};
  for (auto value:values) if(value < -100 || value > 100) return false;
  for(int i=0;i<4;++i) out.axes[i]=axis(values[i]);
  // Source bit13 Touchpad intentionally has no CSV v1 destination.
  const uint8_t source[]={0,1,2,3,4,5,6,7,10,11,8,9,12,14,15,16,17};
  for(uint8_t dest=0;dest<17;++dest) if(in.buttons&(1UL<<source[dest])) out.buttons|=1UL<<dest;
  out.connected=true;return true;
}
inline bool serialize(const Frame& f,char* buffer,size_t capacity) {
  const int n=snprintf(buffer,capacity,"%u,%d,%d,%d,%d,%lu\n",f.connected?1U:0U,
    f.connected?f.axes[0]:0,f.connected?f.axes[1]:0,f.connected?f.axes[2]:0,f.connected?f.axes[3]:0,
    (unsigned long)(f.connected?f.buttons:0));
  return n>0 && (size_t)n<capacity;
}
class Publisher {
  bool active_=false,neutralSent_=false;
  uint32_t lastReport_=0;
 public:
  static constexpr uint32_t timeoutMs=250;
  void invalidate(){active_=false;neutralSent_=false;}
  bool update(bool connected,bool fresh,const Input& in,uint32_t now,char* buffer,size_t capacity) {
    Frame frame;
    if(connected && fresh && mapInput(in,frame)) {
      if(!serialize(frame,buffer,capacity)) return false;
      lastReport_=now;active_=true;neutralSent_=false;return true;
    }
    if(!connected || (fresh && !frame.connected) || (active_ && (uint32_t)(now-lastReport_)>timeoutMs)) active_=false;
    if(!active_ && !neutralSent_) {if(!serialize(Frame{},buffer,capacity))return false;neutralSent_=true;return true;}
    return false; // No heartbeat or cached connected-frame retransmission.
  }
};
}} // namespaces
