// Derived from firmware/ps4_bridge/ReportGate.h by tools/i2c-demo-headers.mjs; do not edit.
#pragma once
namespace codelab { namespace ps4bridge {
class ReportGate {
  bool waitForDisconnect_=false;
 public:
  template<class Read> bool readFresh(bool connected,bool updated,Read read) {return allow(connected)&&updated&&read();}
  void resetRequested(){waitForDisconnect_=true;}
  bool allow(bool connected){if(!connected)waitForDisconnect_=false;return connected&&!waitForDisconnect_;}
};
}}
