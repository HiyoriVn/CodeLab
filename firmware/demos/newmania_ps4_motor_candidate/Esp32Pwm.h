#pragma once
#include <Arduino.h>
#include "SingleMotor.h"

// LEDC 5 kHz / 8 bit is a compile/test candidate, not hardware validation.
class Esp32Pwm final : public codelab::motor_test::PwmIo {
  uint8_t fi_=0,bi_=0;
  bool fiAttached_=false,biAttached_=false, configured_=false;
 public:
  bool begin(uint8_t fi, uint8_t bi) override {
    if (!((fi==39 && bi==40)||(fi==41 && bi==42))) return false;
    fi_=fi; bi_=bi; configured_=true;
    digitalWrite(fi_,LOW); digitalWrite(bi_,LOW);
    pinMode(fi_,OUTPUT); pinMode(bi_,OUTPUT);
    fiAttached_=ledcAttach(fi_,5000,8);
    if (!fiAttached_) { emergencyLow(); return false; }
    if (!ledcWrite(fi_,0)) { emergencyLow(); return false; }
    biAttached_=ledcAttach(bi_,5000,8);
    if (!biAttached_ || !ledcWrite(bi_,0)) { emergencyLow(); return false; }
    return true;
  }
  bool apply(uint8_t fi, uint8_t bi) override {
    if (!fiAttached_ || !biAttached_ || (fi && bi)) return false;
    // Both inactive before a new direction; no simultaneous FI/BI PWM.
    return ledcWrite(fi_,0) && ledcWrite(bi_,0) &&
      (!fi || ledcWrite(fi_,fi)) && (!bi || ledcWrite(bi_,bi));
  }
  void emergencyLow() override {
    if (!configured_) return;
    if (fiAttached_) { ledcWrite(fi_,0); ledcDetach(fi_); fiAttached_=false; }
    if (biAttached_) { ledcWrite(bi_,0); ledcDetach(bi_); biAttached_=false; }
    digitalWrite(fi_,LOW); digitalWrite(bi_,LOW);
    pinMode(fi_,OUTPUT); pinMode(bi_,OUTPUT);
  }
};
