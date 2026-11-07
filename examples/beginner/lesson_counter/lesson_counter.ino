#include <Arduino.h>
double dem = 0;
double item = 0;
#include <math.h>
uint32_t codelabRepeatCount(double n) { if (!isfinite(n) || n <= 0) return 0; if (n >= UINT32_MAX) return UINT32_MAX; return (uint32_t)n; }
void setup() {
  Serial.begin(115200);
}

void loop() {

  dem = 0;
  {
  const uint32_t __codelab_repeat_limit_0 = codelabRepeatCount(5);
  for (uint32_t __codelab_repeat_0 = 0; __codelab_repeat_0 < __codelab_repeat_limit_0; ++__codelab_repeat_0, delay(1)) {
    dem += 1;
    Serial.println(dem);
    delay(1000);
  }
  }
  delay(2000);
delay(1);
}
