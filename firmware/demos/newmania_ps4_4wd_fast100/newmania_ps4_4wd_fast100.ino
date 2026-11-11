#include <Arduino.h>
#include <Wire.h>
#include <I2CReceiver.h>
#include <CodeLabRobot.h>
#include "QuadMotors.h"

using namespace codelab::robot;

QuadMotors motors;
MockServo servo;

ControlConfig motorConfig() {
  ControlConfig c;

  c.mixer.speedLimit = 1.0f;
  c.accelerationPerSecond = 12.0f;
  c.deadzone = 0.06f;

  // M1 and M2 are reversed relative to M3/M4
  c.mixer.inverted[0] = true;
  c.mixer.inverted[1] = true;
  c.mixer.inverted[2] = false;
  c.mixer.inverted[3] = false;

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
bool armAfterClear = false;

constexpr uint8_t LINK_LED_PIN = 47;

void updateLinkLed(bool linked, uint32_t now) {
  static int previous = -1;

  // Connected: steady ON
  // Disconnected: toggle every 250ms
  const bool ledOn =
    linked || ((now / 250U) % 2U == 0U);

  const int next = ledOn ? 1 : 0;

  if (next != previous) {
    digitalWrite(
      LINK_LED_PIN,
      ledOn ? HIGH : LOW
    );
    previous = next;
  }
}

const char* stateName(State s) {
  if (s == State::ARMED) return "ARMED";
  if (s == State::FAULT) return "FAULT";
  return "DISARMED";
}

void setup() {
  Serial.begin(115200);

  pinMode(LINK_LED_PIN, OUTPUT);
  digitalWrite(LINK_LED_PIN, LOW);
  delay(300);

  Serial.println("=== CODELAB 4WD FAST100 + DUAL STICK ===");
  Serial.println("M1/M2 REVERSED; M3/M4 NORMAL");

  Serial.println("STEP 1: I2C INIT");

  busReady = Wire.begin(8, 9, uint32_t(100000));
  Wire.setTimeOut(20);

  Serial.printf("I2C ready=%u\n", unsigned(busReady));

  Serial.println("STEP 2: FOUR MOTOR INIT");

  bool motorReady = motors.begin();

  Serial.printf("MOTOR ready=%u\n", unsigned(motorReady));
  Serial.println("M1=35/36 M2=37/38 M3=39/40 M4=41/42");

  Serial.println("OPTIONS = ARM + ENABLE");
  Serial.println("SHARE = DISARM + STOP");
  Serial.println("PS = CLEAR OTHER FAULTS");
  Serial.println("NO SERIAL e/c REQUIRED");
  Serial.println("OUTPUT LOCKED ON STARTUP");
}

void loop() {
  uint32_t before = millis();

  motors.expire(before);
  receiver.watchdog(before);

  static uint32_t polled = 0;

  if (busReady && uint32_t(before - polled) >= 6) {
    polled = before;

    size_t count = Wire.requestFrom(
      uint8_t(0x30),
      codelab::ps4i2c::frameSize
    );

    uint8_t bytes[codelab::ps4i2c::frameSize];
    size_t received = 0;

    while (Wire.available() && received < sizeof(bytes)) {
      bytes[received++] = uint8_t(Wire.read());
    }

    receiver.ingest(
      bytes,
      count == sizeof(bytes) ? received : 0,
      millis()
    );
  }

  uint32_t now = millis();
  receiver.watchdog(now);

  auto input = receiver.snapshot(now);
  // LEFT stick:
  // Y = forward / backward
  // X = rotate around robot center
  //
  // RIGHT stick:
  // X = mecanum strafe left / right

  const int16_t turn = input.lx;
  const int16_t strafe = input.rx;

  // Right stick X -> lateral movement
  input.lx = strafe;

  // Left stick X -> rotation
  // Sign reversed from the previous spin version
  input.rx = 0;

  if (abs(turn) > 100) {
    input.rx = turn;
    input.ly = 0;
  }

  auto request = controls.requests(input, now);

  bool fresh =
    input.hasReport &&
    input.connected &&
    !receiver.timedOut(now) &&
    uint32_t(now - input.reportAt) <=
      RobotController::watchdogMs;

  updateLinkLed(fresh, now);

  bool neutral =
    abs(input.lx) <= 80 &&
    abs(input.ly) <= 80 &&
    abs(input.rx) <= 80 &&
    abs(input.ry) <= 80 &&
    (input.buttons & ((1UL << 13) | (1UL << 14))) == 0;

  // Never auto-arm merely because the controller reconnects
  if (!fresh || request.disarm) {
    armAfterClear = false;
  }

  // One deliberate Options press clears a LINK fault.
  // Arming occurs on the following tick, not the same tick.
  if (request.arm &&
      robot.state() == State::FAULT &&
      robot.fault() == Fault::LINK &&
      fresh && neutral && motors.ready()) {

    request.arm = false;
    request.clearFault = true;
    armAfterClear = true;

    Serial.println("OPTIONS: CLEAR LINK FAULT");
  }

  if (armAfterClear && robot.state() == State::DISARMED) {
    armAfterClear = false;
    if (fresh && neutral) {
      request.arm = true;
    }
  }

  if (!busReady || receiver.timedOut(now)) {
    robot.linkFault();
  }

  State previousState = robot.state();

  robot.tick(input, now, request, false);

  // Enable all four motors on the ARMED transition.
  if (previousState != State::ARMED &&
      robot.state() == State::ARMED) {

    if (fresh && motors.permit(now)) {
      Serial.println("OPTIONS: ARM + 4 MOTORS ENABLED");
    } else {
      robot.linkFault();
      Serial.println("MOTOR ENABLE FAILED - OUTPUT STOPPED");
    }
  }

  // Keep the existing motor timeout alive only while
  // the PS4 link and controller state are valid.
  if (robot.state() == State::ARMED &&
      fresh && motors.permitted()) {
    motors.renew(now);
  }

  static uint32_t printed = 0;

  if (uint32_t(now - printed) >= 1000) {
    printed = now;

    Serial.printf(
      "4WD connected=%u state=%s fault=%u EN=%u "
      "M1=%u/%u M2=%u/%u M3=%u/%u M4=%u/%u "
      "fresh=%lu errors=%lu\n",

      unsigned(input.connected),
      stateName(robot.state()),
      unsigned(robot.fault()),
      unsigned(motors.permitted()),

      unsigned(motors.m1FI()),
      unsigned(motors.m1BI()),

      unsigned(motors.m2FI()),
      unsigned(motors.m2BI()),

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


