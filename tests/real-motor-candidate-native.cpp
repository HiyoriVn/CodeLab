#include <cassert>
#include <cmath>
#include <vector>
#include "SingleMotor.h"
using namespace codelab::robot;
using namespace codelab::motor_test;
struct Fake : PwmIo {
  uint8_t pin1=0,pin2=0,fi=0,bi=0; bool available=true,fail=false; unsigned emergency=0; std::vector<unsigned> history;
  bool begin(uint8_t a,uint8_t b) override { pin1=a; pin2=b; fi=bi=0; return available; }
  bool apply(uint8_t a,uint8_t b) override { if(fail) return false; assert(!(a&&b));fi=a;bi=b;history.push_back((unsigned(a)<<8)|b);return true; }
  void emergencyLow() override { fi=bi=0;++emergency; }
};
template<unsigned N> void exercise() {
  Fake io; SingleMotor<N> motor(io); MockServo servo; ControlConfig cfg;cfg.mixer.speedLimit=.5f;
  RobotController robot(motor,servo,cfg);assert(io.history.empty());assert(motor.begin());
  assert(io.pin1==(N==3?39:41)&&io.pin2==(N==3?40:42));
  Input in;in.hasReport=in.connected=true;
  auto tick=[&](unsigned t, Requests q={}) {in.reportAt=t;robot.tick(in,t,q,false);};
  tick(0);Requests arm;arm.arm=true;tick(10,arm);assert(robot.state()==State::ARMED);
  in.ly=1000;tick(60);assert(io.fi==0&&io.bi==0&&!motor.permitted());
  // The firmware only permits at neutral; direct call exercises the backend gate.
  assert(motor.permit(60));assert(!motor.permit(61));tick(110);assert(io.fi>0&&io.fi<=127&&io.bi==0);
  in.ly=-1000;for(unsigned t=160;t<=510;t+=50)tick(t);assert(io.bi>0&&io.bi<=127&&io.fi==0);
  Requests disarm;disarm.disarm=true;tick(520,disarm);assert(robot.state()==State::DISARMED&&io.fi==0&&io.bi==0&&!motor.permitted());
  in.ly=0;tick(530);tick(540,arm);assert(robot.state()==State::ARMED);assert(motor.permit(540));in.ly=1000;tick(590);assert(io.fi>0);
  in.connected=false;robot.tick(in,600,{},false);assert(robot.state()==State::FAULT&&io.fi==0&&io.bi==0&&!motor.permitted());
  in.connected=true;in.ly=0;tick(610,arm);assert(robot.state()==State::FAULT&&!motor.permitted());
  Requests clear;clear.clearFault=true;tick(620,clear);assert(robot.state()==State::DISARMED&&!motor.permitted());
  tick(630,arm);assert(robot.state()==State::ARMED);assert(motor.permit(630));in.ly=1000;tick(680);assert(io.fi>0);
  robot.tick(in,931,{},false);assert(robot.state()==State::FAULT&&io.fi==0&&io.bi==0&&!motor.permitted());
  in.ly=0;tick(940,clear);assert(robot.state()==State::DISARMED);tick(950,arm);assert(robot.state()==State::ARMED);assert(motor.permit(950));
  io.fail=true;in.ly=1000;tick(1000);assert(robot.state()==State::FAULT&&io.emergency&&io.fi==0&&io.bi==0&&!motor.ready());
  Fake timerIo;SingleMotor<N> timer(timerIo);assert(timer.begin());assert(timer.permit(0xfffffff0U));
  float speeds[4]={};speeds[N-1]=0.5f;assert(timer.write(speeds));assert(timerIo.fi>0);
  timer.expire(uint32_t(0xfffffff0U+1999U));assert(timer.permitted());
  timer.expire(uint32_t(0xfffffff0U+2000U));assert(!timer.permitted()&&timerIo.fi==0&&timerIo.bi==0);
  assert(timer.write(speeds));assert(timerIo.fi==0&&timerIo.bi==0);assert(timer.permit(15010));timer.expire(30010);assert(!timer.permitted());
  Fake bad;bad.available=false;SingleMotor<N> other(bad);assert(!other.begin());assert(!other.ready()&&bad.emergency);
}
int main() { exercise<3>();exercise<4>(); }
