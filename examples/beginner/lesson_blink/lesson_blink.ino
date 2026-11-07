#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  pinMode(47, OUTPUT);
}

void loop() {

  digitalWrite(47, HIGH);
  delay(500);
  digitalWrite(47, LOW);
  delay(500);
delay(1);
}
