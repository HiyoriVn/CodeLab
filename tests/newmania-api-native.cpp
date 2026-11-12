#include "fast4wd-platform.h"
#include <cmath>
#include <cstring>
#include <limits>
#define PS 230
#include <CodeLabNewmania.h>
static_assert(PS == 230, "Keep SDK register macro");
using namespace codelab::newmania;
constexpr uint32_t cross=1,share=1U<<8,options=1U<<9;
Board* current=nullptr;
ButtonCursor first,second,released;
unsigned resets=0,steps=0,presses=0,otherPresses=0,releases=0,resumes=0;
bool requestWait=false,motionWait=false;
uint32_t motion=0;
void reset(){++resets;steps=0;}
Board::Step program(Board::Context& ctx,uint32_t){
  ++steps;
  if(ctx.pc==0){current->connectPs4();ctx.pc=1;return Board::Step::YIELD;}
  if(ctx.pc==1 && requestWait){
    requestWait=false;
    if(motionWait){motion=current->runFor(Motor::M1,Direction::Forward,30,1000);return current->waitMotion(ctx,motion,2);}
    current->power(Motor::M1,30);return current->wait(ctx,200,2);
  }
  if(ctx.pc==2){++resumes;ctx.pc=1;}
  if(current->button(Button::X,ButtonState::Pressed,first))++presses;
  if(current->button(Button::X,ButtonState::Pressed,second))++otherPresses;
  if(current->button(Button::X,ButtonState::Released,released))++releases;
  return Board::Step::YIELD;
}
void fresh(Board& b,uint32_t buttons=0,int16_t lx=0){
  clockMs+=20;Wire.report.connected=true;Wire.report.sequence=(Wire.report.sequence+1)&127;
  Wire.report.buttons=buttons;Wire.report.axes[0]=lx;b.update();
}
void tick(Board& b,unsigned count){for(unsigned i=0;i<count;++i){clockMs+=20;b.update();}}
void stopped(){for(const auto& motor:enabled)for(bool output:motor)assert(!output);}
void fixture(Board& b,uint32_t start=0){
  clockMs=start;Wire.report={};Wire.onPoll=nullptr;current=&b;
  resets=steps=presses=otherPresses=releases=resumes=0;requestWait=motionWait=false;motion=0;
  first={};second={};released={};serialCapacity=64;serialOutput.clear();
  assert(!b.registerProgram(0,program));assert(!b.registerProgram(1,nullptr));
  assert(b.registerProgram(1,program,reset));assert(!b.registerProgram(2,program));
  b.begin(true,true,cross,1);b.begin();
}
void recover(Board& b){fresh(b);fresh(b);fresh(b,cross);fresh(b);}
void testBootEdgesAndButtons(){
  Board b;assert(!b.connectPs4());b.update();fixture(b);
  b.update();assert(b.running()&&resets==1);stopped();
  fresh(b,cross);fresh(b,cross);assert(!b.power(Motor::M1,40));stopped();
  fresh(b);fresh(b,cross);fresh(b,cross);assert(b.power(Motor::M1,40));fresh(b,cross);assert(led==HIGH);
  assert(b.motorPwm(Motor::M1)>39);
  const auto before=resets;
  fresh(b,cross|share|options);assert(b.running()&&resets==before&&b.motorPwm(Motor::M1)>39);
  fresh(b);const unsigned count=presses;
  fresh(b,cross);fresh(b,cross);assert(presses==count+1&&otherPresses==presses);
  fresh(b);const unsigned beforeWrap=presses;
  for(int i=0;i<140;++i){fresh(b,i%2?0:cross);}
  assert(presses==beforeWrap+70&&otherPresses==presses&&releases>0);
  assert(!b.button(static_cast<Button>(255),ButtonState::Pressed,first));
  assert(b.axis(static_cast<Axis>(255))==0);
  const auto step=steps;serialCapacity=0;assert(b.message("ready"));
  for(int i=0;i<20;++i){fresh(b);}assert(steps>step&&uint32_t(clockMs-b.heartbeatAt())<10);
  serialCapacity=64;fresh(b);assert(serialOutput.find("ready\n")!=std::string::npos);
  b.stopAllMotors();fresh(b);stopped();assert(b.running());
}
void testLossWaitAndReconnect(){
  Board b;fixture(b,0xfffffe00U);b.update();recover(b);
  motionWait=true;requestWait=true;fresh(b);assert(motion&&b.motionActive(motion));
  for(int i=0;i<5;++i){fresh(b);}assert(b.motorPwm(Motor::M1)>29);
  const auto before=steps;
  tick(b,14);assert(!b.connected()&&b.running()&&!b.motionActive(motion));stopped();
  const auto ledBefore=led;tick(b,13);assert(led!=ledBefore);
  assert(resumes==1&&steps>before&&resets==1);
  for(int i=0;i<5;++i){fresh(b,cross,32767);}stopped();assert(!b.power(Motor::M1,50));
  fresh(b);fresh(b);stopped();assert(!b.power(Motor::M1,50));
  fresh(b,cross);assert(b.power(Motor::M1,50));for(int i=0;i<4;++i){fresh(b,cross);}
  assert(b.motorPwm(Motor::M1)>49&&resets==1);
  motionWait=false;requestWait=true;fresh(b);const unsigned resumed=resumes;
  Wire.report.connected=false;clockMs+=20;b.update();stopped();assert(b.running());
  tick(b,6);assert(resumes==resumed);tick(b,5);assert(resumes==resumed+1&&b.running());
}
void testOwnershipMessagesAndFaults(){
  Board b(25);fixture(b);b.update();recover(b);
  const auto handle=b.runFor(Motor::M2,Direction::Forward,80,160);assert(handle&&b.motionActive(handle));
  for(int i=0;i<4;++i){fresh(b);}assert(b.motorPwm(Motor::M2)>24&&b.motorPwm(Motor::M2)<=25);
  assert(b.power(Motor::M2,-20)&&!b.motionActive(handle));for(int i=0;i<12;++i){fresh(b);}
  assert(b.motorPwm(Motor::M2)<-19);b.stopAllMotors();fresh(b);stopped();
  assert(!b.runFor(Motor::M1,Direction::Forward,20,0));
  assert(!b.runFor(Motor::M1,Direction::Forward,20,5001));assert(!b.power(static_cast<Motor>(4),20));
  assert(!b.message(static_cast<const char*>(nullptr)));
  for(int i=0;i<8;++i){assert(b.message(double(i)));}assert(!b.message("overflow"));
  char text[128];assert(b.popMessage(text,sizeof(text))&&std::strcmp(text,"0")==0);
  char oversized[129];std::memset(oversized,'x',128);oversized[128]=0;assert(!b.message(oversized));
  assert(!b.message(std::numeric_limits<double>::quiet_NaN()));
  Board::Context stale;stale.scriptUid=1;stale.runGeneration=b.runGeneration()-1;
  assert(b.wait(stale,20,2)==Board::Step::DONE&&b.waitMotion(stale,1,2)==Board::Step::DONE);
  Board::Context ctx;ctx.scriptUid=1;ctx.runGeneration=b.runGeneration();
  assert(b.waitMotion(ctx,0,7)==Board::Step::YIELD&&ctx.pc==7&&b.running());
  assert(b.wait(ctx,60001,2)==Board::Step::DONE&&!b.running());fresh(b);stopped();
}
unsigned autoSteps=0;
Board::Step automatic(Board::Context&,uint32_t){++autoSteps;current->power(Motor::M3,35);return Board::Step::YIELD;}
void testAutonomousAndStall(){
  Board b;clockMs=0;Wire.report={};current=&b;autoSteps=0;
  assert(b.registerProgram(1,automatic));b.begin(true,false);stopped();
  for(int i=0;i<20;++i){clockMs+=20;b.update();}
  assert(b.running()&&!b.connected()&&autoSteps==20&&b.motorPwm(Motor::M3)>34);
  fresh(b,share|options);assert(b.running()&&b.motorPwm(Motor::M3)>34);
  tick(b,20);assert(b.running()&&!b.connected()&&b.motorPwm(Motor::M3)>34);
  clockMs+=251;b.update();stopped();assert(!b.running());fresh(b,options);assert(!b.running());
  assert(Board::repeatCount(-1)==0&&Board::repeatCount(3.9)==3);
}
unsigned once=0;
Board::Step done(Board::Context&,uint32_t){++once;return Board::Step::DONE;}
void testDone(){Board b;clockMs=0;Wire.report={};once=0;assert(b.registerProgram(1,done));b.begin();tick(b,20);assert(once==1&&!b.running());stopped();}
int main(){testBootEdgesAndButtons();testLossWaitAndReconnect();testOwnershipMessagesAndFaults();testAutonomousAndStall();testDone();
  std::puts("PASS: boot without ARM, independent edges, no Share/Options system actions, wait/link/wrap/recovery, ownership, autonomous, messages and stale generations");}
