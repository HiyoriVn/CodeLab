#include <Arduino.h>
#include <driver/gpio.h>
#include "BoardConfig.h"
#include "SafeStartup.h"

namespace {
struct Esp32StartupIo {
  bool hiZ(uint8_t pin) {
    const auto gpio=static_cast<gpio_num_t>(pin);
    if (gpio_set_direction(gpio, GPIO_MODE_INPUT)!=ESP_OK) return false;
    return gpio_set_pull_mode(gpio, GPIO_FLOATING)==ESP_OK;
  }
  bool preloadLow(uint8_t pin) {
    return gpio_set_level(static_cast<gpio_num_t>(pin), 0)==ESP_OK;
  }
  bool output(uint8_t pin) {
    return gpio_set_direction(static_cast<gpio_num_t>(pin), GPIO_MODE_OUTPUT)==ESP_OK;
  }
};
codelab::SafeStartup startup;
}
void setup() {
  Esp32StartupIo io;
  startup.begin(io); // Status retained; no automatic peripherals or arming on success/failure.
}
void loop() {
  delay(1000); // Yield to the Arduino/RTOS scheduler; no peripheral work.
}
