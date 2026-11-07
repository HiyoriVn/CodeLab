#include <Arduino.h>
#include <driver/gpio.h>
static bool codelabSafeStartup() {
  const uint8_t servos[] = {12, 13, 14, 15};
  const uint8_t lowOutputs[] = {35, 36, 37, 38, 39, 40, 41, 42, 17};
  bool ok = true;
  for (uint8_t pin : servos) {
    const auto gpio = (gpio_num_t)pin;
    ok = (gpio_set_direction(gpio, GPIO_MODE_INPUT) == ESP_OK) && ok;
    ok = (gpio_set_pull_mode(gpio, GPIO_FLOATING) == ESP_OK) && ok;
  }
  for (uint8_t pin : lowOutputs) ok = (gpio_set_level((gpio_num_t)pin, 0) == ESP_OK) && ok;
  if (!ok) return false;
  for (uint8_t pin : lowOutputs) ok = (gpio_set_direction((gpio_num_t)pin, GPIO_MODE_OUTPUT) == ESP_OK) && ok;
  return ok;
}
void setup() {
  if (!codelabSafeStartup()) { while (true) delay(1000); }
  Serial.begin(115200);
}

void loop() {
  Serial.printf("PSRAM_PRESENT=%u PSRAM_BYTES=%u FLASH_BYTES=%u\n",
    psramFound() ? 1U : 0U, (unsigned)ESP.getPsramSize(), (unsigned)ESP.getFlashChipSize());
  delay(1000);
}
