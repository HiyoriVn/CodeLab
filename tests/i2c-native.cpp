#include <cassert>
#include <cstdio>
#include <cstring>
#include <I2CReceiver.h>
#include <Ps4ControlMapping.h>
using namespace codelab::ps4i2c;
static codelab::ps4i2c::Frame frame(uint8_t seq) { Frame f;f.connected=true;f.sequence=seq;return f; }
int main() {
  uint8_t bytes[frameSize];Frame decoded;
  Frame f=frame(127);f.axes[0]=-32768;f.axes[1]=32767;f.axes[2]=-1;f.axes[3]=256;f.buttons=0x89abcdef;
  encode(f,bytes);assert(bytes[0]==255&&bytes[1]==0&&bytes[2]==128&&bytes[3]==255&&bytes[4]==127);
  assert(bytes[9]==0xef&&bytes[10]==0xcd&&bytes[11]==0xab&&bytes[12]==0x89);
  assert(decode(bytes,13,decoded)&&samePayload(f,decoded)&&decoded.sequence==127);
  assert(!decode(bytes,12,decoded)&&!decode(nullptr,13,decoded));
  f.connected=false;encode(f,bytes);assert(bytes[0]==254);for(unsigned i=1;i<13;++i)assert(bytes[i]==0);
  puts("PASS codec:13 bytes,flags7bit sequence,signed axes,uint32 LE,disconnect neutral,short/null rejection");

  Publisher publisher;codelab::ps4bridge::Input input;
  publisher.bytes(0,bytes);assert(bytes[0]==0);
  publisher.update(true,true,input,0);publisher.bytes(0,bytes);assert(bytes[0]==3);
  uint8_t copy[13];memcpy(copy,bytes,13);
  for(uint32_t t=1;t<=250;++t) {publisher.update(true,false,input,t);publisher.bytes(t,bytes);assert(memcmp(bytes,copy,13)==0);}
  publisher.bytes(251,bytes);assert(bytes[0]==2);for(unsigned i=1;i<13;++i)assert(bytes[i]==0);
  publisher.update(true,true,input,252);publisher.bytes(252,bytes);assert(bytes[0]==5); // identical NEW report advances
  publisher.update(false,false,input,253);publisher.bytes(253,bytes);assert(bytes[0]==4);
  for(unsigned n=0;n<126;++n) publisher.update(true,true,input,254+n);
  publisher.bytes(400,bytes);assert((bytes[0]>>1)==0);
  input.lx=101;publisher.update(true,true,input,401);publisher.bytes(401,bytes);assert(bytes[0]==0);
  publisher.invalidate();assert(publisher.reportAt()==379);
  Publisher wrappedSource;input={};wrappedSource.update(true,true,input,UINT32_MAX-100);
  wrappedSource.bytes(149,bytes);assert(bytes[0]&1);wrappedSource.bytes(150,bytes);assert(!(bytes[0]&1));
  puts("PASS publisher:polling never increments,identical fresh report advances,250/251ms,disconnect,wrap,invalid source");

  Receiver receiver;f=frame(127);encode(f,bytes);assert(!receiver.ingest(bytes,13,0));assert(!receiver.snapshot(0).connected);
  f.sequence=0;encode(f,bytes);assert(receiver.ingest(bytes,13,1));assert(receiver.snapshot(1).connected);
  for(uint32_t t=2;t<=251;++t) { assert(!receiver.ingest(bytes,13,t)); }
  assert(receiver.snapshot(251).connected);
  receiver.watchdog(252);assert(receiver.timedOut(252));auto neutral=receiver.snapshot(252);assert(!neutral.connected&&neutral.lx==0&&neutral.buttons==0);
  assert(!receiver.ingest(bytes,13,253));assert(!receiver.snapshot(253).connected); // old cache cannot revive
  f.sequence=1;encode(f,bytes);assert(receiver.ingest(bytes,13,254));
  f.axes[0]=100;encode(f,bytes);assert(!receiver.ingest(bytes,13,255));assert(!receiver.snapshot(255).connected); // torn payload/same seq
  f.sequence=2;encode(f,bytes);assert(receiver.ingest(bytes,13,256));
  assert(!receiver.ingest(bytes,12,257));assert(!receiver.snapshot(257).connected);
  assert(!receiver.ingest(bytes,13,258));assert(!receiver.snapshot(258).connected); // cached after bus error
  f.sequence=3;encode(f,bytes);assert(receiver.ingest(bytes,13,259));
  f.sequence=100;encode(f,bytes);assert(!receiver.ingest(bytes,13,260)); // ambiguous/backward jump rebases
  f.sequence=101;encode(f,bytes);assert(receiver.ingest(bytes,13,261));
  f.connected=false;encode(f,bytes);assert(!receiver.ingest(bytes,13,262));assert(!receiver.snapshot(262).connected);
  Receiver wrap(UINT32_MAX-100);f=frame(10);encode(f,bytes);wrap.ingest(bytes,13,UINT32_MAX-100);
  f.sequence=11;encode(f,bytes);wrap.ingest(bytes,13,UINT32_MAX-100);
  assert(wrap.snapshot(149).connected);wrap.watchdog(150);assert(wrap.timedOut(150)&&!wrap.snapshot(150).connected);
  Receiver noData;assert(!noData.timedOut(250)&&noData.timedOut(251));
  Receiver gap;f=frame(1);encode(f,bytes);gap.ingest(bytes,13,0);
  f.sequence=2;encode(f,bytes);assert(gap.ingest(bytes,13,1));gap.ingest(nullptr,0,5);
  f.sequence=3;encode(f,bytes);assert(!gap.ingest(bytes,13,300)); // bus error then long gap: quarantine first frame
  assert(!gap.snapshot(300).connected);f.sequence=4;encode(f,bytes);assert(gap.ingest(bytes,13,310));
  puts("PASS receiver:baseline quarantine,127to0,new sequence only,timeout recovery,bus errors,torn frames,ambiguous delta,clock wrap");

  // Actual A2 mapping -> I2C publisher -> sequence receiver -> existing robot/mecanum/servo.
  Publisher source;Receiver sink;codelab::robot::MockMotors motors;codelab::robot::MockServo servo;
  codelab::robot::RobotController idle(motors,servo);
  if(noData.timedOut(251))idle.linkFault();
  idle.tick(noData.snapshot(251),251);assert(idle.state()==codelab::robot::State::FAULT);
  codelab::robot::RobotController robot(motors,servo);codelab::robot::Ps4ControlMapping buttons;
  input={};
  auto send=[&](uint32_t now,bool fresh=true,bool connected=true,bool servoPower=false) {
    source.update(connected,fresh,input,now);source.bytes(now,bytes);sink.ingest(bytes,13,now);
    sink.watchdog(now);auto state=sink.snapshot(now);
    if(sink.timedOut(now))robot.linkFault();
    robot.tick(state,now,buttons.requests(state,now),servoPower);return state;
  };
  send(0);send(10);input.buttons=1UL<<11;send(20);assert(robot.state()==codelab::robot::State::ARMED);
  input.buttons=0;input.ly=100;auto state=send(70);assert(state.ly==1000);for(float x:motors.speeds)assert(x>0);
  send(320,false);assert(robot.state()==codelab::robot::State::ARMED);
  send(321,false);assert(robot.state()==codelab::robot::State::FAULT);for(float x:motors.speeds)assert(x==0);
  input.ly=0;input.buttons=1UL<<11;send(330);send(340);assert(robot.state()==codelab::robot::State::FAULT);
  input.buttons=0;send(350);input.buttons=1UL<<12;send(360);assert(robot.state()==codelab::robot::State::DISARMED);
  input.buttons=0;send(370);input.buttons=1UL<<11;send(380);assert(robot.state()==codelab::robot::State::ARMED);
  input.buttons=1UL<<10;send(390);assert(robot.state()==codelab::robot::State::DISARMED);
  codelab::robot::Requests enable;enable.enableServo=true;
  input.buttons=0;send(400);input.buttons=1UL<<11;send(410);
  state=sink.snapshot(410);robot.tick(state,411,enable,true);assert(servo.enabled);
  input.buttons=1UL<<14;send(420,true,true,true); // source Dpad Up14 -> CodeLab bit13
  assert(robot.servo().angle()>90);
  input.buttons=1UL<<15;send(430,true,true,true);assert(robot.servo().angle()<90.4051f);
  send(440); // Removing mock power token must disable/fault, never keep servo active.
  assert(robot.state()==codelab::robot::State::FAULT&&!servo.enabled);
  // All201 library percentages preserve axis scaling on I2C, no extra Y inversion.
  for(int p=-100;p<=100;++p){
    Publisher mapped;Receiver r;input={};input.ly=int16_t(p);
    mapped.update(true,true,input,0);mapped.bytes(0,bytes);r.ingest(bytes,13,0);
    mapped.update(true,true,input,1);mapped.bytes(1,bytes);r.ingest(bytes,13,1);
    assert(r.snapshot(1).ly==10*p);
  }
  puts("PASS integration:real A2 mapping,mecanum output,stale FAULT,neutral recovery,Share/Options/PS,servo safety,201 Y vectors");
}
