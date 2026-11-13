#pragma once
#include <cassert>
#include <cstddef>
#include <cstdint>
#include <string>
#include "I2CFrame.h"

#define CONFIG_IDF_TARGET_ESP32S3 1
constexpr int LOW = 0, HIGH = 1, INPUT = 0, OUTPUT = 1, ESP_OK = 0;
constexpr int CHIP_ESP32S3 = 2, CHIP_FEATURE_EMB_PSRAM = 128, ESP_EFUSE_FLASH_TYPE = 1;
struct esp_chip_info_t { int model; int features; };
inline bool embeddedPsram = false;
inline bool octalFlash = false;
inline uint32_t flashSize = 16U * 1024 * 1024, clockMs = 0;
inline unsigned gpioCalls = 0;
inline int led = LOW;
inline uint32_t millis() { return clockMs; }
inline void delay(uint32_t ms) { clockMs += ms; }
inline void esp_chip_info(esp_chip_info_t* chip) { *chip = {CHIP_ESP32S3, embeddedPsram ? CHIP_FEATURE_EMB_PSRAM : 0}; }
inline bool psramFound() { return false; }
inline int esp_efuse_read_field_blob(int field, uint8_t* value, int bits) {
  assert(field == ESP_EFUSE_FLASH_TYPE && bits == 1);
  *value = octalFlash;
  return ESP_OK;
}
inline int serialCapacity = 64;
inline std::string serialOutput;
inline std::string serialInput;
inline size_t serialInputOffset = 0;
inline struct {
  void begin(unsigned baud) { assert(baud == 115200); }
  void println(const char*) {}
  int available() const { return static_cast<int>(serialInput.size() - serialInputOffset); }
  int read() { return available() ? static_cast<unsigned char>(serialInput[serialInputOffset++]) : -1; }
  int availableForWrite() const { return serialCapacity; }
  size_t write(uint8_t byte) { if (serialCapacity <= 0) return 0; serialOutput += char(byte); return 1; }
  template<typename... Args> void printf(const char*, Args...) {}
} Serial;
inline void pinMode(uint8_t, int mode) { assert(mode == OUTPUT || mode == INPUT); ++gpioCalls; }
inline void digitalWrite(uint8_t pin, int value) {
  ++gpioCalls;
  if (pin == 47) led = value;
  else assert(pin >= 35 && pin <= 42 && value == LOW);
}
inline bool ledcAttachedPins[50] = {};
inline uint32_t ledcDutyPins[50] = {};
inline unsigned ledcAttachCalls = 0;
inline unsigned ledcWriteCalls = 0;
inline unsigned ledcDetachCalls = 0;
inline bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t resolution) {
  assert(pin >= 12 && pin <= 15);
  assert(freq == 50);
  assert(resolution == 14);
  ledcAttachedPins[pin] = true;
  ++ledcAttachCalls;
  return true;
}
inline bool ledcWrite(uint8_t pin, uint32_t duty) {
  assert(pin >= 12 && pin <= 15);
  ledcDutyPins[pin] = duty;
  ++ledcWriteCalls;
  return true;
}
inline bool ledcDetach(uint8_t pin) {
  assert(pin >= 12 && pin <= 15);
  ledcAttachedPins[pin] = false;
  ledcDutyPins[pin] = 0;
  ++ledcDetachCalls;
  return true;
}
inline struct {
  codelab::ps4i2c::Frame report;
  void (*onPoll)(codelab::ps4i2c::Frame&) = nullptr;
  uint8_t bytes[codelab::ps4i2c::frameSize] = {};
  size_t offset = 0;
  bool begin(int sda, int scl, uint32_t frequency) {
    assert(sda == 8 && scl == 9 && frequency == 100000);
    return true;
  }
  void setTimeOut(int timeout) { assert(timeout == 20); }
  size_t requestFrom(uint8_t addr, size_t size) {
    assert(addr == 0x30 && size == sizeof(bytes));
    if (onPoll) onPoll(report);
    codelab::ps4i2c::encode(report, bytes);
    offset = 0;
    return sizeof(bytes);
  }
  bool available() const { return offset < sizeof(bytes); }
  int read() { return bytes[offset++]; }
} Wire;

using gpio_num_t = int;
using mcpwm_unit_t = int;
using mcpwm_timer_t = int;
using mcpwm_generator_t = int;
using mcpwm_io_signals_t = int;
constexpr int MCPWM_UNIT_0 = 0, MCPWM_UNIT_1 = 1, MCPWM_TIMER_0 = 0, MCPWM_TIMER_1 = 1, MCPWM_TIMER_2 = 2;
constexpr int MCPWM0A = 0, MCPWM0B = 1, MCPWM1A = 2, MCPWM1B = 3, MCPWM2A = 4, MCPWM2B = 5;
constexpr int MCPWM_OPR_A = 0, MCPWM_OPR_B = 1, MCPWM_UP_COUNTER = 0, MCPWM_DUTY_MODE_0 = 0;
struct mcpwm_config_t { uint32_t frequency; float cmpr_a, cmpr_b; int counter_mode, duty_mode; };
inline int routed[4][2] = {};
inline float duty[4][2] = {};
inline bool enabled[4][2] = {};
inline int slot(int unit, int timer) {
  assert((unit == 0 && timer >= 0 && timer <= 2) || (unit == 1 && timer == 0));
  return unit == 0 ? timer : 3;
}
inline int gpio_reset_pin(int pin) { assert(pin >= 35 && pin <= 42); return ESP_OK; }
inline int mcpwm_gpio_init(int unit, int signal, int pin) {
  routed[slot(unit, signal / 2)][signal % 2] = pin;
  return ESP_OK;
}
inline int mcpwm_init(int unit, int timer, const mcpwm_config_t* config) {
  const int i = slot(unit, timer);
  assert(routed[i][0] == 35 + i * 2 && routed[i][1] == 36 + i * 2);
  assert(config->frequency == 1000 && config->cmpr_a == 0 && config->cmpr_b == 0);
  return ESP_OK;
}
inline int mcpwm_set_duty(int unit, int timer, int op, float value) {
  assert(value >= 0 && value <= 100);
  duty[slot(unit, timer)][op] = value;
  return ESP_OK;
}
inline int mcpwm_set_signal_low(int unit, int timer, int op) {
  enabled[slot(unit, timer)][op] = false;
  return ESP_OK;
}
inline int mcpwm_set_duty_type(int unit, int timer, int op, int) {
  const int i = slot(unit, timer);
  assert(!enabled[i][1 - op]);
  enabled[i][op] = true;
  return ESP_OK;
}
inline int mcpwm_stop(int, int) { return ESP_OK; }
