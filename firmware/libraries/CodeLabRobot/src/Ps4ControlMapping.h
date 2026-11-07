#pragma once
#include "RobotController.h"
namespace codelab { namespace robot {
// Binding proposals: Options arm, Share disarm, PS clear fault. Rising edges only.
class Ps4ControlMapping {
  uint32_t previous_=0; bool linked_=false;
 public:
  Requests requests(const Input& in, uint32_t now) {
    const bool live=in.hasReport&&in.connected&&uint32_t(now-in.reportAt)<=RobotController::watchdogMs;
    if(!live) { linked_=false; previous_=0; return {}; }
    if(!linked_) { linked_=true; previous_=in.buttons; return {}; }
    const uint32_t rising=in.buttons&~previous_; previous_=in.buttons;
    Requests r; r.arm=(rising&(1UL<<9))!=0; r.disarm=(rising&(1UL<<8))!=0;
    r.clearFault=(rising&(1UL<<12))!=0;
    return r; // servo enable intentionally has no automatic controller binding
  }
};
// Reuses the original parser's normalized accessors and actual report timestamp.
// Polling never creates a report or refreshes freshness. UART only for this task.
template<class Parser> Input snapshot(const Parser& parser) {
  Input in; in.hasReport=parser.hasReport(); in.connected=parser.connected();
  in.reportAt=parser.lastReportAt();
  in.lx=parser.axis(0); in.ly=parser.axis(1); in.rx=parser.axis(2); in.ry=parser.axis(3);
  for(unsigned bit=0;bit<17;++bit) if(parser.button(bit)) in.buttons|=1UL<<bit;
  return in;
}
} }
