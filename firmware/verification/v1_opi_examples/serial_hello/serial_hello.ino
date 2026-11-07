#include <Arduino.h>

void setup() {
  Serial.begin(115200);
}

void loop() {

Serial.println("Hello, Newmania!");
delay((uint32_t)max(0.0, (double)(1000)));
}
