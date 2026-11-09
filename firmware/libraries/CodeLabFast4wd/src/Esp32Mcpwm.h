#pragma once
#include <Arduino.h>
#include <driver/gpio.h>
#include <driver/mcpwm.h>
#include "SingleMotor.h"

// fast100 mapping: unit 0 timers 0–2 for M1–M3, unit 1 timer 0 for M4.
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
 public:
  bool begin(uint8_t fi,uint8_t bi) override {
    if (initialized_) return fi==fi_ && bi==bi_;
    if (!((fi==35&&bi==36)||(fi==37&&bi==38)||(fi==39&&bi==40)||(fi==41&&bi==42))) return false;
    fi_=fi;bi_=bi;configured_=true;
    unit_=fi==41?MCPWM_UNIT_1:MCPWM_UNIT_0;
    timer_=fi==35?MCPWM_TIMER_0:fi==37?MCPWM_TIMER_1:fi==39?MCPWM_TIMER_2:MCPWM_TIMER_0;
    const mcpwm_io_signals_t a=fi==37?MCPWM1A:fi==39?MCPWM2A:MCPWM0A;
    const mcpwm_io_signals_t b=fi==37?MCPWM1B:fi==39?MCPWM2B:MCPWM0B;
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


