#include <cassert>
#include <cstdio>
#include <DemoConfig.h>
#include <DemoRuntime.h>
using namespace codelab::robot;
int main() {
  static_assert(!demo::uartEnabled,"Never silently assume physical rewire done");
  static_assert(demo::rx==21&&demo::tx==18,"Proposed reference UART only");
  for(int pin:{0,3,12,13,14,15,17,19,20,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,45,46,47})
    assert(!demo::uartCandidate(pin));
  assert(!demo::validUart(21,21));assert(demo::validUart(21,18));
  assert(!demo::hardwareMotorsEnabled&&!demo::hardwareServoEnabled);
  demo::Rz7899Duty d;assert(demo::rz7899Plan(0,d)&&d.fi==0&&d.bi==0);
  assert(demo::rz7899Plan(1,d)&&d.fi==38&&d.bi==0);
  assert(demo::rz7899Plan(-1,d)&&d.fi==0&&d.bi==38);
  assert(!demo::rz7899Plan(NAN,d)&&d.fi==0&&d.bi==0);
  demo::Runtime r;Input in;in.hasReport=in.connected=true;
  auto step=[&](uint32_t t,uint32_t buttons=0,int16_t ly=0){in.reportAt=t;in.buttons=buttons;in.ly=ly;r.tick(in,t);};
  step(0);step(10,1UL<<9);assert(r.controller().state()==State::DISARMED); // monitor never arms
  assert(r.command("MOTOR_TEST M1 F 0.1")==demo::CommandResult::BLOCKED);
  assert(r.command("SERVO_ENABLE")==demo::CommandResult::BLOCKED);
  assert(r.command("ARM")==demo::CommandResult::BLOCKED);
  assert(r.command("SERVO_SIM_ENABLE")==demo::CommandResult::BLOCKED);
  assert(r.command("SIM_ON")==demo::CommandResult::OK);step(20);step(30,1UL<<9);
  assert(r.controller().state()==State::ARMED);
  assert(r.command("SERVO_SIM_ENABLE")==demo::CommandResult::OK);step(40);
  assert(r.servo().enabled);step(90,1UL<<13,1000);
  for(auto duty:r.motors().duty)assert(duty.fi>0&&duty.fi<=38&&duty.bi==0);
  assert(r.controller().servo().angle()>90);
  step(100,1UL<<8);assert(r.controller().state()==State::DISARMED);assert(!r.servo().enabled);
  step(110);step(120,1UL<<9);step(170,0,-1000);
  for(auto duty:r.motors().duty)assert(duty.bi>0&&duty.fi==0);
  in.reportAt=170;r.tick(in,421);assert(r.controller().state()==State::FAULT);
  for(auto duty:r.motors().duty)assert(duty.fi==0&&duty.bi==0);
  step(430,1UL<<9);assert(r.controller().state()==State::FAULT);
  step(440);step(450,1UL<<12);assert(r.controller().state()==State::DISARMED);
  assert(r.command("SIM_OFF")==demo::CommandResult::OK);step(460);step(470,1UL<<9);
  assert(!r.simulation()&&r.controller().state()==State::DISARMED);
  puts("PASS demo: monitor/explicit SIM,UART gate,reserved pins,RZ7899 duties,Share/Options/PS,servo mock,timeout/reconnect,hardware commands blocked");
}
