#include <Arduino.h>
#include <driver/gpio.h>
static bool codelabSafeStartup() {
  const uint8_t servos[] = {14, 15, 16, 17, 18, 21};
  const uint8_t lowOutputs[] = {42, 41, 40, 39, 38, 37, 36, 35, 48, 34, 33, 47, 26};
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
static void codelabServoDisable(uint8_t pin) {
  const auto gpio = (gpio_num_t)pin;
  const bool inputOk = gpio_set_direction(gpio, GPIO_MODE_INPUT) == ESP_OK;
  const bool pullOk = gpio_set_pull_mode(gpio, GPIO_FLOATING) == ESP_OK;
  if (!inputOk || !pullOk) Serial.println("Servo disable failed");
}
void setup() {
  if (!codelabSafeStartup()) { while (true) delay(1000); }
  Serial.begin(115200);
}

void loop() {

codelabServoDisable(14);
codelabServoDisable(15);
codelabServoDisable(16);
codelabServoDisable(17);
codelabServoDisable(18);
codelabServoDisable(21);
Serial.println(Serial.available());
Serial.println(Serial.read());
Serial.println("Robotics \"software\" test\n");
delay((uint32_t)max(0.0, (double)(250)));
}
