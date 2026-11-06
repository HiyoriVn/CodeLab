#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  Serial.println("Hello, CodeLab!");

}

void loop() {

  Serial.println((Serial.available() > 0));
  delay(1000);
delay(1);
}
