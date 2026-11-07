#include <Arduino.h>
#include <CodeLabRobot.h>
#include "GeneratedPs4Parser.h"

// Compile-only mainboard simulation, no actuator backend, UART or board-GPIO init.
// Never reuse the old N8R2 motor startup on the observed Octal-memory board.
CodeLabPS4Adapter parser;
codelab::robot::MockMotors motors;
codelab::robot::MockServo servo;
codelab::robot::RobotController robot(motors,servo);
codelab::robot::Ps4ControlMapping controls;

void setup() { Serial.begin(115200); }
void loop() {
  parser.update(); // No beginUart: transport intentionally disabled pending wiring review.
  const auto now=millis();
  const auto input=codelab::robot::snapshot(parser);
  robot.tick(input,now,controls.requests(input,now),false);
  static uint32_t printed=0;
  if(uint32_t(now-printed)>=1000) {
    printed=now;
    Serial.printf("SIMULATION_ONLY state=%u motors_enabled=%u servo_enabled=%u\n",
      unsigned(robot.state()),motors.enabled?1U:0U,servo.enabled?1U:0U);
  }
  delay(10);
}
