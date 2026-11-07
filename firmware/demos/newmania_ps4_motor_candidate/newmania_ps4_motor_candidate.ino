#include <Arduino.h>
#include <Wire.h>
#include <I2CReceiver.h>
#include <CodeLabRobot.h>
#include "Esp32Mcpwm.h"
#ifndef CODELAB_TEST_MOTOR
#error "Choose CODELAB_TEST_MOTOR=3 or 4 explicitly; hardware test only"
#endif
static_assert(CODELAB_TEST_MOTOR == 3 || CODELAB_TEST_MOTOR == 4, "M1/M2 are blocked by OPI");
#ifndef CODELAB_PS4_I2C_ADDRESS
#define CODELAB_PS4_I2C_ADDRESS 0x30
#endif
static_assert(CODELAB_PS4_I2C_ADDRESS>=0x08&&CODELAB_PS4_I2C_ADDRESS<=0x77,"Invalid 7-bit I2C address");
using namespace codelab::robot;
Esp32Mcpwm motorIo;
codelab::motor_test::SingleMotor<CODELAB_TEST_MOTOR> motors(motorIo);
MockServo servo;
ControlConfig mockConfig() {
  ControlConfig c;c.mixer.speedLimit=0.5f;
  c.servo.minimum=45;c.servo.maximum=135;c.servo.initial=90;c.servo.rateDegPerSecond=30;
  return c;
}
// Reuses the existing controller; selected motor GPIO is configured in setup.
RobotController robot(motors,servo,mockConfig());
Ps4ControlMapping controls;
codelab::ps4i2c::Receiver receiver;
bool busReady=false;
bool pendingOutputEnable=false;
Requests pending;
const char* stateName(State state) {
  return state==State::ARMED?"ARMED":state==State::FAULT?"FAULT":"DISARMED";
}
void consoleTick() {
  // Explicit output-enable command is processed only after a fresh neutral tick.
  for(unsigned n=0;n<32&&Serial.available();++n) {
    const char c=char(Serial.read());
    if(c=='d'||c=='D') pending.disarm=true;
    if(c=='c'||c=='C') pending.clearFault=true;
    if(c=='e'||c=='E') pendingOutputEnable=true;
  }
}
void setup() {
  Serial.begin(115200);
  const bool motorReady=motors.begin();
  Serial.printf("ONE MOTOR TEST M%d GPIO%d/%d LOW, MCPWM 1000Hz capped 50%%, 2s active/15s enable maximum; ready=%u; OUTPUT INHIBITED UNTIL e\n", CODELAB_TEST_MOTOR, motors.fiPin, motors.biPin, motorReady?1U:0U);
  busReady=Wire.begin(8,9,uint32_t(100000));Wire.setTimeOut(20);
  Serial.printf("I2C master SDA8/SCL9 addr=0x%02X ready=%u; SINGLE MOTOR TEST; N16R8 OPI preserved\n",
    CODELAB_PS4_I2C_ADDRESS,busReady?1U:0U);
  Serial.println("Options=arm neutral; Share/disarm d; PS/clear c; e=enable selected motor ONLY at neutral.");
}
void loop() {
  const auto before=millis();motors.expire(before);receiver.watchdog(before);consoleTick();
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
  pending={};
  if(!busReady||receiver.timedOut(now)) robot.linkFault();
  robot.tick(input,now,request,false);
  const bool neutral = abs(input.lx)<=80 && abs(input.ly)<=80 && abs(input.rx)<=80 && abs(input.ry)<=80 &&
    (input.buttons & ((1UL<<13)|(1UL<<14)))==0;
  if (pendingOutputEnable) {
    if (robot.state()==State::ARMED && input.connected && neutral && !request.arm && !request.disarm && !request.clearFault && motors.permit(now))
      Serial.println("OUTPUT ENABLED: selected single motor only");
    else Serial.println("OUTPUT REMAINS INHIBITED: arm and release controls first");
    pendingOutputEnable=false;
  }
  static uint32_t printed=0;
  if(uint32_t(now-printed)>=250) {
    printed=now;
    Serial.printf("ONE_MOTOR_TEST connected=%u seq=%u LX=%d LY=%d RX=%d RY=%d buttons=%lu FL=%.3f FR=%.3f RL=%.3f RR=%.3f OUTPUT_ENABLED=%u FI=%u BI=%u SERVO_DISABLED %s fault=%u fresh=%lu repeats=%lu errors=%lu\n",
      input.connected?1U:0U,receiver.sequence(),input.lx,input.ly,input.rx,input.ry,(unsigned long)input.buttons,
      motors.requested[0],motors.requested[1],motors.requested[2],motors.requested[3],motors.permitted()?1U:0U,unsigned(motors.fiDuty),unsigned(motors.biDuty),
      stateName(robot.state()),unsigned(robot.fault()),(unsigned long)receiver.advances,(unsigned long)receiver.repeats,(unsigned long)receiver.errors);
  }
  delay(2);
}
