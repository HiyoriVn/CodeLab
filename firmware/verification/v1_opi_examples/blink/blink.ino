#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  pinMode(47, OUTPUT);
}

void loop() {

digitalWrite(47, HIGH);
delay((uint32_t)max(0.0, (double)(500)));
digitalWrite(47, LOW);
delay((uint32_t)max(0.0, (double)(500)));
}
