#include <Arduino.h>
double diem = 0;
double item = 0;
int32_t codelabRandom(int32_t a, int32_t b) {
  if (a > b) { int32_t t = a; a = b; b = t; }
  const uint64_t span = (int64_t)b - (int64_t)a + 1;
  const uint64_t range = UINT64_C(1) << 32;
  const uint64_t limit = range - range % span;
  uint64_t sample;
  do { sample = ((uint32_t)random(65536) << 16) | (uint32_t)random(65536); } while (sample >= limit);
  return (int32_t)((int64_t)a + (int64_t)(sample % span));
}
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
