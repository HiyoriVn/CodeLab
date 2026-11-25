#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <esp_arduino_version.h>
#include "DiagnosticPacket.h"

namespace codelab { namespace i2cdiag {
inline void banner(const char* role, int sda, int scl) {
  Serial.begin(115200);
  delay(1500); // Bounded USB startup; never wait indefinitely for Serial.
  Serial.setDebugOutput(true);
  Serial.printf("\nI2C_DIAG role=%s chip=%s Arduino=%d.%d.%d IDF=%s SDA=%d SCL=%d addr=0x%02X Hz=100000 timeout_ms=20\n",
    role, ESP.getChipModel(), ESP_ARDUINO_VERSION_MAJOR, ESP_ARDUINO_VERSION_MINOR,
    ESP_ARDUINO_VERSION_PATCH, ESP.getSdkVersion(), sda, scl, address);
}
inline const char* errorName(uint8_t code) {
  // These cores collapse NACK errors into 2; do not infer address vs data phase.
  switch (code) {
    case 0: return "ACK";
    case 1: return "BUFFER_TOO_LONG";
    case 2: return "NACK_OR_NOT_FOUND";
    case 3: return "DATA_NACK_IF_REPORTED";
    case 4: return "OTHER_DRIVER_ERROR";
    case 5: return "TIMEOUT";
    default: return "UNKNOWN";
  }
}
inline void dump(const char* label, const uint8_t* data, size_t size) {
  Serial.printf("%s len=%u hex=", label, unsigned(size));
  for (size_t i = 0; i < size; ++i) Serial.printf("%02X ", data[i]);
  Serial.println();
}
inline uint8_t probe(uint8_t target) {
  Wire.beginTransmission(target);
  const uint32_t started = micros();
  const uint8_t code = Wire.endTransmission(true);
  Serial.printf("PROBE addr=0x%02X code=%u %s elapsed_us=%lu\n",
    target, code, errorName(code), (unsigned long)(micros() - started));
  return code;
}
} }
