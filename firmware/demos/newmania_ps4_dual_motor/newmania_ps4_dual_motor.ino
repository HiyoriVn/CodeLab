#include <Arduino.h>
#include <Wire.h>
#include <I2CReceiver.h>
#include <CodeLabRobot.h>
#include "DualMotors.h"

using namespace codelab::robot;

// Motor M3 + M4 that su
DualMotors motors;

// Servo van la mo phong, khong xuat tin hieu
MockServo servo;

ControlConfig motorConfig() {
  ControlConfig c;
  c.mixer.speedLimit = 0.5f;
  c.servo.minimum = 45;
  c.servo.maximum = 135;
  c.servo.initial = 90;
  c.servo.rateDegPerSecond = 30;
  return c;
}

RobotController robot(motors, servo, motorConfig());
Ps4ControlMapping controls;
codelab::ps4i2c::Receiver receiver;

bool busReady = false;
bool pendingEnable = false;
Requests pending;

const char* stateName(State s) {
  if (s == State::ARMED) return "ARMED";
  if (s == State::FAULT) return "FAULT";
  return "DISARMED";
}

void consoleTick() {
  for (unsigned n = 0; n < 32 && Serial.available(); ++n) {
    char c = char(Serial.read());
    if (c == 'd' || c == 'D') pending.disarm = true;
    if (c == 'c' || c == 'C') pending.clearFault = true;
    if (c == 'e' || c == 'E') pendingEnable = true;
  }
}

void setup() {
  Serial.begin(115200);

  bool motorReady = motors.begin();
  Serial.printf(
    "DUAL MOTOR M3+M4 MCPWM 1000Hz ready=%u\n",
    motorReady ? 1U : 0U
  );

  busReady = Wire.begin(8, 9, uint32_t(100000));
  Wire.setTimeOut(20);

  Serial.printf(
    "I2C SDA8 SCL9 addr=0x30 ready=%u\n",
    busReady ? 1U : 0U
  );

  Serial.println("M3 GPIO39/40; M4 GPIO41/42");
  Serial.println("PWM MAX 50%, active max 2 seconds");
  Serial.println("Options=ARM; e=ENABLE; Share/d=STOP; PS/c=CLEAR");
  Serial.println("OUTPUT LOCKED UNTIL ARM AND ENABLE");
}

void loop() {
  uint32_t before = millis();

  motors.expire(before);
  receiver.watchdog(before);
  consoleTick();

  static uint32_t polled = 0;
  if (busReady && uint32_t(before - polled) >= 10) {
    polled = before;

    size_t count = Wire.requestFrom(
      uint8_t(0x30),
      codelab::ps4i2c::frameSize
    );

    uint8_t bytes[codelab::ps4i2c::frameSize];
    size_t read = 0;

    while (Wire.available() && read < sizeof(bytes)) {
      bytes[read++] = uint8_t(Wire.read());
    }

    receiver.ingest(
      bytes,
      count == sizeof(bytes) ? read : 0,
      millis()
    );
  }

  uint32_t now = millis();
  receiver.watchdog(now);

  auto input = receiver.snapshot(now);
  auto request = controls.requests(input, now);

  request.disarm |= pending.disarm;
  request.clearFault |= pending.clearFault;
  pending = {};

  if (!busReady || receiver.timedOut(now)) {
    robot.linkFault();
  }

  robot.tick(input, now, request, false);

  bool neutral =
    abs(input.lx) <= 80 &&
    abs(input.ly) <= 80 &&
    abs(input.rx) <= 80 &&
    abs(input.ry) <= 80 &&
    (input.buttons & ((1UL << 13) | (1UL << 14))) == 0;

  if (pendingEnable) {
    bool allowed =
      robot.state() == State::ARMED &&
      input.hasReport &&
      input.connected &&
      !receiver.timedOut(now) &&
      uint32_t(now - input.reportAt) <=
        RobotController::watchdogMs &&
      neutral &&
      !request.arm &&
      !request.disarm &&
      !request.clearFault &&
      motors.permit(now);

    Serial.println(
      allowed ? "DUAL OUTPUT ENABLED" :
                "OUTPUT REMAINS LOCKED"
    );

    pendingEnable = false;
  }

  static uint32_t printed = 0;
  if (uint32_t(now - printed) >= 250) {
    printed = now;

    Serial.printf(
      "DUAL connected=%u state=%s fault=%u "
      "EN=%u M3_FI=%u M3_BI=%u "
      "M4_FI=%u M4_BI=%u "
      "fresh=%lu errors=%lu\n",
      input.connected ? 1U : 0U,
      stateName(robot.state()),
      unsigned(robot.fault()),
      motors.permitted() ? 1U : 0U,
      unsigned(motors.m3FI()),
      unsigned(motors.m3BI()),
      unsigned(motors.m4FI()),
      unsigned(motors.m4BI()),
      (unsigned long)receiver.advances,
      (unsigned long)receiver.errors
    );
  }

  delay(2);
}
