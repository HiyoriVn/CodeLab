#include <Arduino.h>
double dem = 0;
double item = 0;
void setup() {
  Serial.begin(115200);
  dem = 0;

}

void loop() {

  for (uint32_t __codelab_repeat_0 = 0; __codelab_repeat_0 < (5); ++__codelab_repeat_0) {
    dem += 1;
    Serial.println(dem);
  }
  delay(1000);
delay(1);
}
