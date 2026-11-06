#include <Arduino.h>
// PS4 SIMULATION ONLY: no Bluetooth or actuator commands.
static bool lessonConnected = false;
static int lessonLX = 0;
static bool lessonCross = false;
void setup() {
  Serial.begin(115200);
}

void loop() {

  lessonConnected = true;
  lessonLX = lessonConnected ? 500 : 0;
  lessonCross = lessonConnected && true;
  if (lessonConnected) {
    Serial.println("MO PHONG PS4: connected, LX, X:");
    Serial.println(lessonLX);
    Serial.println(lessonCross);
  }
  delay(1000);
delay(1);
}
