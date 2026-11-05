import { DEFAULT_BOARD_ID } from './profiles.js';
// Shared by standalone generated sketches and the firmware test examples.
// GPIO latch writes precede direction changes. No pulse generation or enable API.
export function startupCode(profile) {
  if (profile.id===DEFAULT_BOARD_ID) return { includes: [], definitions: '', setup: [] };
  const motors=profile.pins.motors.flat();
  const low=[...motors,profile.pins.buzzer];
  return {
    includes:['#include <driver/gpio.h>'],
    definitions:`static bool codelabSafeStartup() {
  const uint8_t servos[] = {${profile.pins.servos.join(', ')}};
  const uint8_t lowOutputs[] = {${low.join(', ')}};
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
}`,
    setup:['if (!codelabSafeStartup()) { while (true) delay(1000); }'],
  };
}
