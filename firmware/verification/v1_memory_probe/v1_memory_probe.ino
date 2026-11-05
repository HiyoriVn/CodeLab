#include <Arduino.h>

// Diagnostic candidate only, not a Newmania board profile or hardware acceptance.
// USB-only, all external loads disconnected. Do not initialize board GPIO here:
// GPIO35..37 may belong to Octal PSRAM on the actual module.
void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.printf("MEMORY_PROBE uptime_ms=%lu PSRAM_PRESENT=%u PSRAM_BYTES=%u FLASH_BYTES=%u\n",
    (unsigned long)millis(), psramFound() ? 1U : 0U,
    (unsigned)ESP.getPsramSize(), (unsigned)ESP.getFlashChipSize());
  delay(1000);
}
