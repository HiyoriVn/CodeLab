#include <Arduino.h>
double diem = 0;
double item = 0;
long codelabRandom(long a, long b) { if (a > b) { long t = a; a = b; b = t; } if (b == LONG_MAX) return a; return random(a, b + 1); }
#include <limits.h>
void setup() {
  Serial.begin(115200);
}

void loop() {

  diem = codelabRandom(1, 10);
  if ((diem > 5)) {
    Serial.println("Lon hon 5");
  } else {
    Serial.println("Khong lon hon 5");
  }
  delay(1000);
delay(1);
}
