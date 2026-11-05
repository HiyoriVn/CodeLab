#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  if (!ledcAttach(47, 5000, 8)) Serial.println("PWM setup failed");
}

void loop() {

ledcWrite(47, (uint32_t)constrain((int)(32), 0, 255));
delay((uint32_t)max(0.0, (double)(1000)));
}
