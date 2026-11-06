#include <Arduino.h>
#include <Wire.h>
#include <I2CReceiver.h>
#include <CodeLabRobot.h>
#ifndef CODELAB_PS4_I2C_ADDRESS
#define CODELAB_PS4_I2C_ADDRESS 0x30
#endif
static_assert(CODELAB_PS4_I2C_ADDRESS>=0x08&&CODELAB_PS4_I2C_ADDRESS<=0x77,"Invalid 7-bit I2C address");
using namespace codelab::robot;
MockMotors motors;MockServo servo;
ControlConfig mockConfig() {
  ControlConfig c;c.mixer.speedLimit=0.15f;
  c.servo.minimum=45;c.servo.maximum=135;c.servo.initial=90;c.servo.rateDegPerSecond=30;
  return c;
}
// Same mecanum/controller/servo logic; no physical driver or load GPIO initialization.
RobotController robot(motors,servo,mockConfig());
Ps4ControlMapping controls;
codelab::ps4i2c::Receiver receiver;
bool busReady=false,servoMockPermission=false;
Requests pending;
const char* stateName(State state) {
  return state==State::ARMED?"ARMED":state==State::FAULT?"FAULT":"DISARMED";
}
void consoleTick() {
  // Explicit mock servo permission, never a hardware power-good input.
  for(unsigned n=0;n<32&&Serial.available();++n) {
    const char c=char(Serial.read());
    if(c=='d'||c=='D') pending.disarm=true;
    if(c=='c'||c=='C') pending.clearFault=true;
    if(c=='s'||c=='S') { servoMockPermission=true;pending.enableServo=true; }
  }
}
void setup() {
  Serial.begin(115200);
  busReady=Wire.begin(8,9,uint32_t(100000));Wire.setTimeOut(20);
  Serial.printf("I2C master SDA8/SCL9 addr=0x%02X ready=%u; ACTUATORS=MOCK_ONLY; N16R8 OPI preserved\n",
    CODELAB_PS4_I2C_ADDRESS,busReady?1U:0U);
  Serial.println("Options=arm neutral; Share/disarm d; PS/clear c; s=enable MOCK servo only after arm.");
}
void loop() {
  const auto before=millis();receiver.watchdog(before);consoleTick();
  static uint32_t polled=0;
  if(busReady&&uint32_t(before-polled)>=10) {
    polled=before;
    const size_t count=Wire.requestFrom(uint8_t(CODELAB_PS4_I2C_ADDRESS),codelab::ps4i2c::frameSize);
    uint8_t bytes[codelab::ps4i2c::frameSize];size_t read=0;
    while(Wire.available()&&read<sizeof(bytes)) bytes[read++]=uint8_t(Wire.read());
    receiver.ingest(bytes,count==sizeof(bytes)?read:0,millis());
  }
  const auto now=millis();receiver.watchdog(now);
  const auto input=receiver.snapshot(now);auto request=controls.requests(input,now);
  request.disarm=request.disarm||pending.disarm;
  request.clearFault=request.clearFault||pending.clearFault;
  request.enableServo=pending.enableServo;pending={};
  if(!busReady||receiver.timedOut(now)) robot.linkFault();
  robot.tick(input,now,request,servoMockPermission);
  if(robot.state()!=State::ARMED) servoMockPermission=false;
  static uint32_t printed=0;
  if(uint32_t(now-printed)>=250) {
    printed=now;
    Serial.printf("MOCK_ONLY connected=%u seq=%u LX=%d LY=%d RX=%d RY=%d buttons=%lu FL=%.3f FR=%.3f RL=%.3f RR=%.3f servo_target=%.1f enabled=%u %s fault=%u fresh=%lu repeats=%lu errors=%lu\n",
      input.connected?1U:0U,receiver.sequence(),input.lx,input.ly,input.rx,input.ry,(unsigned long)input.buttons,
      motors.speeds[0],motors.speeds[1],motors.speeds[2],motors.speeds[3],robot.servo().angle(),servo.enabled?1U:0U,
      stateName(robot.state()),unsigned(robot.fault()),(unsigned long)receiver.advances,(unsigned long)receiver.repeats,(unsigned long)receiver.errors);
  }
  delay(2);
}
