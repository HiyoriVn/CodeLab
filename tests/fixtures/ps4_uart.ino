#include <Arduino.h>
#include <driver/gpio.h>
#include <stdio.h>
#include <Wire.h>
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
class CodeLabPS4Adapter {
  HardwareSerial* serial_ = nullptr;
  uint8_t address_ = 0;
  bool i2c_ = false;
  int16_t axes_[4] = {0, 0, 0, 0};
  uint32_t buttons_ = 0;
  bool receiverConnected_ = false;
  uint32_t lastFrameAt_ = 0;
  char line_[96] = {0};
  size_t lineLength_ = 0;
  bool discardLine_ = false;

  bool hasFrame_ = false;

  static bool unsignedField(const char*& p, uint32_t limit, uint32_t& value) {
    if (*p < '0' || *p > '9') return false;
    value = 0;
    do {
      const uint32_t digit = (uint32_t)(*p - '0');
      if (digit > limit || value > (limit - digit) / 10U) return false;
      value = value * 10U + digit;
      ++p;
    } while (*p >= '0' && *p <= '9');
    return true;
  }

  static bool signedField(const char*& p, int16_t& value) {
    const bool negative = *p == '-';
    if (negative) ++p;
    uint32_t magnitude;
    if (!unsignedField(p, negative ? 32768U : 32767U, magnitude)) return false;
    value = (int16_t)(negative ? -(int32_t)magnitude : (int32_t)magnitude);
    return true;
  }

  void parseLine() {
    const char* p = line_;
    uint32_t connected, buttons;
    int16_t axes[4];
    if (!unsignedField(p, 1U, connected) || *p++ != ',') return;
    for (uint8_t i = 0; i < 4; ++i) {
      if (!signedField(p, axes[i]) || *p++ != ',') return;
    }
    if (!unsignedField(p, UINT32_MAX, buttons) || *p != '\0') return;
    for (uint8_t i = 0; i < 4; ++i) axes_[i] = connected ? axes[i] : 0;
    buttons_ = connected ? buttons : 0;
    receiverConnected_ = connected == 1;
    hasFrame_ = true;
    lastFrameAt_ = millis();
  }

  void readUart() {
    if (!serial_) return;
    while (serial_->available()) {
      const char ch = (char)serial_->read();
      if (ch == '\n') {
        if (lineLength_ && !discardLine_) {
          if (line_[lineLength_ - 1] == '\r') --lineLength_;
          line_[lineLength_] = '\0';
          if (lineLength_) parseLine();
        }
        lineLength_ = 0;
        discardLine_ = false;
      } else if (ch != '\0' && !discardLine_ && lineLength_ < sizeof(line_) - 1) {
        line_[lineLength_++] = ch;
      } else {
        lineLength_ = 0;
        discardLine_ = true;
      }
    }
  }

  static int16_t readI16(uint8_t low, uint8_t high) {
    return (int16_t)((uint16_t)low | ((uint16_t)high << 8));
  }

  void readI2c() {
    if (!i2c_) return;
    const uint8_t received = Wire.requestFrom(address_, (uint8_t)13);
    if (received != 13 || Wire.available() < 13) {
      while (Wire.available()) Wire.read();
      return;
    }
    uint8_t frame[13];
    for (uint8_t i = 0; i < 13; ++i) frame[i] = (uint8_t)Wire.read();
    axes_[0] = readI16(frame[1], frame[2]);
    axes_[1] = readI16(frame[3], frame[4]);
    axes_[2] = readI16(frame[5], frame[6]);
    axes_[3] = readI16(frame[7], frame[8]);
    buttons_ = (uint32_t)frame[9] | ((uint32_t)frame[10] << 8) |
      ((uint32_t)frame[11] << 16) | ((uint32_t)frame[12] << 24);
    receiverConnected_ = (frame[0] & 0x01) != 0;
    hasFrame_ = true;
    lastFrameAt_ = millis();
  }

public:
  void beginUart(HardwareSerial& serial) { serial_ = &serial; i2c_ = false; }
  void beginI2c(uint8_t address) { address_ = address; i2c_ = true; }
  void update() { if (i2c_) readI2c(); else readUart(); }
  bool connected() const { return hasFrame_ && receiverConnected_ && (uint32_t)(millis() - lastFrameAt_) <= 250; }
  int axis(uint8_t index) const {
    if (!connected() || index > 3) return 0;
    return (int)map(axes_[index], -32768, 32767, -1000, 1000);
  }
  bool button(uint8_t index) const {
    return connected() && index < 32 && ((buttons_ >> index) & 1U);
  }
};
CodeLabPS4Adapter codelabPs4;
void setup() {
  if (!codelabSafeStartup()) { while (true) delay(1000); }
  Serial.begin(115200);
  Serial1.begin(115200, SERIAL_8N1, 7, 6); codelabPs4.beginUart(Serial1);
}

void loop() {
  codelabPs4.update();

}
