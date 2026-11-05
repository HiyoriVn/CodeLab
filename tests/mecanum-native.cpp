#include <cassert>
#include <cstdio>
#include <cmath>
#include <cstdint>
#include <string>
#define INPUT 0x01 // Match Arduino macro namespace during host builds too.
#include <CodeLabRobot.h>
#include "MappingPublisher.h"
uint32_t clockMs=0;
uint32_t millis(){return clockMs;}
long map(long x,long a,long b,long c,long d){return (x-a)*(d-c)/(b-a)+c;}
struct HardwareSerial {
  std::string q; size_t at=0;
  int available(){return at<q.size();}
  int read(){return static_cast<unsigned char>(q[at++]);}
  void feed(const std::string& s){q+=s;}
};
struct WireMock {
  int requestFrom(uint8_t,uint8_t){return 0;} int available(){return 0;} int read(){return 0;}
} Wire;
#include "ParserUnderTest.h"
using namespace codelab::robot;
static bool near(float a,float b){return std::fabs(a-b)<0.0001f;}
static void zero(const MockMotors& m){assert(!m.enabled);for(float x:m.speeds)assert(x==0);}
static Input live(uint32_t t){Input i;i.hasReport=i.connected=true;i.reportAt=t;return i;}
static Requests arm(){Requests r;r.arm=true;return r;}

int main(){
  // Wheel goldens, simultaneous-input saturation, permutation, inversion, limits.
  MixerConfig mix;mix.speedLimit=1;float wheels[4];
  assert(MecanumMixer::mix({1,0,0},mix,wheels));for(float x:wheels)assert(x==1);
  assert(MecanumMixer::mix({0,1,0},mix,wheels));
  assert(wheels[0]==-1&&wheels[1]==1&&wheels[2]==1&&wheels[3]==-1);
  assert(MecanumMixer::mix({0,0,1},mix,wheels));
  assert(wheels[0]==-1&&wheels[1]==1&&wheels[2]==-1&&wheels[3]==1);
  assert(MecanumMixer::mix({1,1,1},mix,wheels));
  assert(near(wheels[0],-1.f/3)&&near(wheels[1],1)&&near(wheels[2],1.f/3)&&near(wheels[3],1.f/3));
  mix.wheelAtOutput[0]=3;mix.wheelAtOutput[3]=0;mix.inverted[0]=true;mix.speedLimit=.4f;
  assert(MecanumMixer::mix({1,1,1},mix,wheels));assert(near(wheels[0],-.4f/3)&&near(wheels[3],-.4f/3));
  mix.wheelAtOutput[0]=0;assert(!MecanumMixer::mix({1,0,0},mix,wheels));for(float x:wheels)assert(x==0);
  mix=MixerConfig{};assert(!MecanumMixer::mix({NAN,0,0},mix,wheels));
  for(int x=-1000;x<=1000;x+=125) for(int y=-1000;y<=1000;y+=125) for(int w=-1000;w<=1000;w+=125){
    assert(MecanumMixer::mix({x/1000.f,y/1000.f,w/1000.f},mix,wheels));
    for(float v:wheels)assert(std::isfinite(v)&&fabsf(v)<=.50001f);
  }
  puts("PASS mixer: basis, combined saturation, permutation/inversion, limits, invalid config/NaN,4913 vectors");

  MockMotors motors;MockServo servo;ControlConfig config;config.deadzone=.1f;
  RobotController robot(motors,servo,config);zero(motors);assert(!servo.enabled);
  Input in=live(0);in.ly=1000;robot.tick(in,0,arm());assert(robot.state()==State::DISARMED);
  in.ly=0;robot.tick(in,1,arm());assert(robot.state()==State::ARMED);zero(motors);
  in.ly=100;in.reportAt=51;robot.tick(in,51);for(float x:motors.speeds)assert(x==0);
  in.ly=1000;in.reportAt=101;robot.tick(in,101);for(float x:motors.speeds)assert(near(x,.05f));
  in.ly=-1000;in.reportAt=151;robot.tick(in,151);for(float x:motors.speeds)assert(near(x,0));
  in.reportAt=201;robot.tick(in,201);for(float x:motors.speeds)assert(near(x,-.05f));
  robot.tick(in,451);assert(robot.state()==State::ARMED); // report age exactly250
  robot.tick(in,452);assert(robot.state()==State::FAULT&&robot.fault()==Fault::LINK);zero(motors);
  in=live(453);robot.tick(in,453);assert(robot.state()==State::FAULT);zero(motors);
  Requests disarm;disarm.disarm=true;robot.tick(in,454,disarm);assert(robot.state()==State::FAULT);
  Requests clear;clear.clearFault=clear.arm=true;robot.tick(in,455,clear);assert(robot.state()==State::DISARMED);
  robot.tick(in,456,arm());assert(robot.state()==State::ARMED);
  in.connected=false;robot.tick(in,457);assert(robot.state()==State::FAULT);zero(motors);assert(!servo.enabled);
  puts("PASS controller: startup, neutral arming, deadzone, acceleration/reversal,250/251ms,disconnect,reconnect,latched fault");

  MockMotors m2;MockServo s2;RobotController r2(m2,s2);in=live(UINT32_MAX-100);
  r2.tick(in,UINT32_MAX-100,arm());r2.tick(in,149);assert(r2.state()==State::ARMED);
  r2.tick(in,150);assert(r2.state()==State::FAULT);zero(m2);
  MockMotors m3;MockServo s3;RobotController r3(m3,s3);in=live(0);r3.tick(in,0,arm());
  in=live(300);r3.tick(in,300);assert(r3.fault()==Fault::LOOP_STALL);zero(m3);
  ControlConfig bad;bad.deadzone=1;RobotController invalid(m3,s3,bad);assert(invalid.fault()==Fault::CONFIG);
  puts("PASS watchdog: unsigned clock wrap, loop stall, invalid configuration");

  MockMotors m4;MockServo s4;ControlConfig sc;sc.servo={30,120,90,60};RobotController r4(m4,s4,sc);
  in=live(0);r4.tick(in,0,arm());assert(!s4.enabled);
  in.buttons=1UL<<13;in.reportAt=50;r4.tick(in,50);assert(!s4.enabled); // Dpad cannot auto-enable
  Requests enable;enable.enableServo=true;r4.tick(in,51,enable,false);assert(r4.state()==State::FAULT);assert(!s4.enabled);
  in=live(52);r4.tick(in,52,clear);r4.tick(in,53,arm());r4.tick(in,54,enable,true);assert(s4.enabled);
  for(uint32_t t=104;t<4104;t+=50){in=live(t);in.buttons=1UL<<13;r4.tick(in,t,{},true);}assert(near(r4.servo().angle(),120));
  for(uint32_t t=4104;t<8104;t+=50){in=live(t);in.buttons=1UL<<14;r4.tick(in,t,{},true);}assert(near(r4.servo().angle(),30));
  in=live(8104);in.buttons=(1UL<<13)|(1UL<<14);r4.tick(in,8104,{},true);assert(near(r4.servo().angle(),30));
  in.reportAt=8154;r4.tick(in,8154,{},false);assert(!s4.enabled);
  s4.available=false;in=live(8204);r4.tick(in,8204,enable,true);assert(r4.state()==State::FAULT);zero(m4);
  MockMotors m5;MockServo s5;RobotController r5(m5,s5);in=live(0);r5.tick(in,0,arm());m5.available=false;
  in=live(10);r5.tick(in,10);assert(r5.fault()==Fault::BACKEND);zero(m5);
  struct FailedWrite : MockMotors { bool write(const float (&)[4]) override {return false;} } failed;
  RobotController failedRobot(failed,s5);in=live(0);failedRobot.tick(in,0,arm());
  in=live(10);failedRobot.tick(in,10);assert(failedRobot.fault()==Fault::BACKEND);zero(failed);
  MockMotors m6;MockServo s6;ControlConfig fast;fast.accelerationPerSecond=100;
  RobotController axes(m6,s6,fast);in=live(0);axes.tick(in,0,arm());
  in=live(50);in.lx=1000;axes.tick(in,50);
  assert(near(m6.speeds[0],-.5f)&&near(m6.speeds[1],.5f)&&near(m6.speeds[2],.5f)&&near(m6.speeds[3],-.5f));
  in=live(100);in.rx=1000;axes.tick(in,100);
  assert(near(m6.speeds[0],-.5f)&&near(m6.speeds[1],.5f)&&near(m6.speeds[2],-.5f)&&near(m6.speeds[3],.5f));
  in=live(150);in.ly=1001;axes.tick(in,150);assert(axes.fault()==Fault::INVALID_INPUT);zero(m6);
  puts("PASS servo/backends: explicit enable+power, bounds, simultaneous Dpad, power loss, faults disable all");

  // Real bridge publisher/mapping -> canonical parser -> controller, not a mock decoder.
  HardwareSerial serial;CodeLabPS4Adapter parser;parser.beginUart(serial);
  MockMotors pm;MockServo ps;RobotController pr(pm,ps);Ps4ControlMapping buttons;
  codelab::ps4bridge::Publisher publisher;codelab::ps4bridge::Input report;char csv[96];
  auto publish=[&](uint32_t t){clockMs=t;assert(publisher.update(true,true,report,t,csv,sizeof(csv)));serial.feed(csv);parser.update();
    auto i=snapshot(parser);pr.tick(i,t,buttons.requests(i,t));return i;};
  report.buttons=1UL<<11;publish(0);assert(pr.state()==State::DISARMED); // Options held on connect suppressed
  report.buttons=0;publish(10);report.buttons=1UL<<11;publish(20);assert(pr.state()==State::ARMED);
  report.buttons=0;report.ly=100;auto state=publish(70);assert(state.ly==1000);assert(pr.state()==State::ARMED);
  for(float x:pm.speeds)assert(x>0); // no second Y inversion
  const auto before=parser.lastReportAt();clockMs=100;parser.update();assert(parser.lastReportAt()==before);
  serial.feed("malformed\n");parser.update();assert(parser.lastReportAt()==before);
  clockMs=321;parser.update();state=snapshot(parser);pr.tick(state,clockMs,buttons.requests(state,clockMs));assert(pr.state()==State::FAULT);zero(pm);
  report.ly=0;report.buttons=1UL<<11;publish(322);assert(pr.state()==State::FAULT); // reconnect/held arm no auto-arm
  report.buttons=0;publish(330);report.buttons=1UL<<12;publish(340);assert(pr.state()==State::DISARMED);
  report.buttons=0;publish(350);report.buttons=1UL<<11;publish(360);assert(pr.state()==State::ARMED);
  // Share disarms, source Share bit10 -> CSV bit8.
  report.buttons=1UL<<10;publish(370);assert(pr.state()==State::DISARMED);zero(pm);
  assert(parser.hasReport());assert(parser.lastReportAt()==370);
  puts("PASS integration: actual CSVv1 publisher/parser, metadata, Options/Share/PS edges, Y preservation, cache/malformed timeout");
  puts("SIMULATION_ONLY: no GPIO/PWM/UART hardware or real actuator backend");
}
