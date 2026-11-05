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
  pinMode(4, OUTPUT);
  pinMode(1, INPUT_PULLUP);
  pinMode(2, INPUT);
  if (!ledcAttach(47, 5000, 8)) Serial.println("PWM setup failed");
}

void loop() {

digitalWrite(4, LOW);
Serial.println((digitalRead(1) == HIGH));
Serial.println(analogRead(2));
ledcWrite(47, (uint32_t)constrain((int)(32), 0, 255));
Serial.println(Serial.available());
Serial.println(Serial.read());
Serial.println("Robotics \"software\" test\n");
delay((uint32_t)max(0.0, (double)(250)));
}
