#include <Arduino.h>

void setup() {
  Serial.begin(115200);
}

void loop() {

Serial.println(Serial.available());
Serial.println(Serial.read());
Serial.println("Robotics \"software\" test\n");
delay((uint32_t)max(0.0, (double)(250)));

Serial.available();
}
