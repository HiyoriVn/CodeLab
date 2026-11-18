#pragma once
#include <Arduino.h>
#include <driver/gpio.h>
#include <driver/mcpwm.h>
#include "SingleMotor.h"

// V1 mapping: unit 0 timers 0–2 for M1–M3, unit 1 timer 0 for M4.
// V2 mapping: unit 0 timers 0–2 for M1–M3, unit 1 timers 0–2 for M4–M6.
class Esp32Mcpwm final : public codelab::motor_test::PwmIo {
  uint8_t fi_=0, bi_=0;
  mcpwm_unit_t unit_=MCPWM_UNIT_0;
  mcpwm_timer_t timer_=MCPWM_TIMER_0;
  bool configured_=false, initialized_=false;
  bool low(mcpwm_generator_t op) {
    const bool dutyOk=mcpwm_set_duty(unit_,timer_,op,0)==ESP_OK;
    const bool forceOk=mcpwm_set_signal_low(unit_,timer_,op)==ESP_OK;
    return dutyOk && forceOk;
  }
  bool active(mcpwm_generator_t op,uint8_t duty) {
    return mcpwm_set_duty(unit_,timer_,op,(100.0f*duty)/255.0f)==ESP_OK &&
      mcpwm_set_duty_type(unit_,timer_,op,MCPWM_DUTY_MODE_0)==ESP_OK;
  }
  static bool mapPins(uint8_t fi, uint8_t bi, mcpwm_unit_t& unit, mcpwm_timer_t& timer,
                      mcpwm_io_signals_t& a, mcpwm_io_signals_t& b) {
    // V1 pairs
    if (fi==35&&bi==36) { unit=MCPWM_UNIT_0; timer=MCPWM_TIMER_0; a=MCPWM0A; b=MCPWM0B; return true; }
    if (fi==37&&bi==38) { unit=MCPWM_UNIT_0; timer=MCPWM_TIMER_1; a=MCPWM1A; b=MCPWM1B; return true; }
    if (fi==39&&bi==40) { unit=MCPWM_UNIT_0; timer=MCPWM_TIMER_2; a=MCPWM2A; b=MCPWM2B; return true; }
    if (fi==41&&bi==42) { unit=MCPWM_UNIT_1; timer=MCPWM_TIMER_0; a=MCPWM0A; b=MCPWM0B; return true; }
    // V2 pairs: M1(42,41), M2(40,39), M3(38,37), M4(36,35), M5(48,34), M6(33,47)
    if (fi==42&&bi==41) { unit=MCPWM_UNIT_0; timer=MCPWM_TIMER_0; a=MCPWM0A; b=MCPWM0B; return true; }
    if (fi==40&&bi==39) { unit=MCPWM_UNIT_0; timer=MCPWM_TIMER_1; a=MCPWM1A; b=MCPWM1B; return true; }
    if (fi==38&&bi==37) { unit=MCPWM_UNIT_0; timer=MCPWM_TIMER_2; a=MCPWM2A; b=MCPWM2B; return true; }
    if (fi==36&&bi==35) { unit=MCPWM_UNIT_1; timer=MCPWM_TIMER_0; a=MCPWM0A; b=MCPWM0B; return true; }
    if (fi==48&&bi==34) { unit=MCPWM_UNIT_1; timer=MCPWM_TIMER_1; a=MCPWM1A; b=MCPWM1B; return true; }
    if (fi==33&&bi==47) { unit=MCPWM_UNIT_1; timer=MCPWM_TIMER_2; a=MCPWM2A; b=MCPWM2B; return true; }
    return false;
  }
 public:
  bool begin(uint8_t fi,uint8_t bi) override {
    if (initialized_) return fi==fi_ && bi==bi_;
    mcpwm_io_signals_t a=MCPWM0A, b=MCPWM0B;
    if (!mapPins(fi, bi, unit_, timer_, a, b)) return false;
    fi_=fi;bi_=bi;configured_=true;
    digitalWrite(fi_,LOW);digitalWrite(bi_,LOW);pinMode(fi_,OUTPUT);pinMode(bi_,OUTPUT);
    mcpwm_config_t config={};config.frequency=1000;config.cmpr_a=0;config.cmpr_b=0;
    config.counter_mode=MCPWM_UP_COUNTER;config.duty_mode=MCPWM_DUTY_MODE_0;
    if (mcpwm_gpio_init(unit_,a,fi_)!=ESP_OK || mcpwm_gpio_init(unit_,b,bi_)!=ESP_OK ||
        mcpwm_init(unit_,timer_,&config)!=ESP_OK) { emergencyLow();return false; }
    initialized_=true; // Only after init succeeds; repeated calls must not reinitialise.
    const bool aLow=low(MCPWM_OPR_A), bLow=low(MCPWM_OPR_B);
    if (!aLow || !bLow) { emergencyLow();return false; }
    return true;
  }
  bool apply(uint8_t fi,uint8_t bi) override {
    if (!initialized_ || (fi && bi)) return false;
    const bool aLow=low(MCPWM_OPR_A), bLow=low(MCPWM_OPR_B);
    if (!aLow || !bLow) return false;
    return fi?active(MCPWM_OPR_A,fi):bi?active(MCPWM_OPR_B,bi):true;
  }
  void emergencyLow() override {
    if (!configured_) return;
    if (initialized_) { low(MCPWM_OPR_A);low(MCPWM_OPR_B);mcpwm_stop(unit_,timer_); }
    // Reset the GPIO matrix routing before driving a best-effort LOW.
    gpio_reset_pin(static_cast<gpio_num_t>(fi_));gpio_reset_pin(static_cast<gpio_num_t>(bi_));
    digitalWrite(fi_,LOW);digitalWrite(bi_,LOW);pinMode(fi_,OUTPUT);pinMode(bi_,OUTPUT);
    initialized_=false;
  }
};
