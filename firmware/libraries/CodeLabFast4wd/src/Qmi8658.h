#pragma once
// QMI8658B 6-axis IMU on Newmania V2: I2C 0x6A, SDA8/SCL9.
// Registers follow QST QMI8658 family documentation. No external library.
// Uses the same Wire bus as PS4 I2C, sequentially from the program loop.
#include <stdint.h>
#include <stddef.h>
#if defined(ARDUINO_ARCH_ESP32)
#include <Arduino.h>
#include <Wire.h>
#endif

namespace codelab { namespace newmania {

enum class ImuChannel : uint8_t { AccX, AccY, AccZ, GyroX, GyroY, GyroZ };

class Qmi8658 {
 public:
  static constexpr uint8_t kAddress = 0x6A, kSda = 8, kScl = 9;
  static constexpr uint8_t kWhoAmI = 0x00, kCtrl1 = 0x02, kCtrl2 = 0x03;
  static constexpr uint8_t kCtrl3 = 0x04, kCtrl7 = 0x08, kStatus0 = 0x2E;
  static constexpr uint8_t kAccXLow = 0x35;
  static constexpr uint32_t kFreshMs = 250;
  // ±4 g => 8192 LSB/g; ±512 dps => 64 LSB/(deg/s).
  static constexpr float kAccelDivisor = 8192.0f, kGyroDivisor = 64.0f;

  bool begin(bool busAlreadyStarted) {
    valid_ = false;
#if defined(ARDUINO_ARCH_ESP32)
    if (!busStarted_) {
      if (!busAlreadyStarted && !Wire.begin(kSda, kScl, uint32_t(100000))) return false;
      Wire.setTimeOut(20);
      busStarted_ = true;
    }
    uint8_t who = 0;
    if (!readRegisters(kWhoAmI, &who, 1) || who != 0x05 ||
        !writeRegister(kCtrl1, 0x40) || // address auto-increment, little-endian
        !writeRegister(kCtrl2, 0x16) || // accel ±4 g, 125 Hz
        !writeRegister(kCtrl3, 0x56) || // gyro ±512 dps, ~112 Hz in 6DOF
        !writeRegister(kCtrl7, 0x03)) { // enable accel + gyro
      configured_ = false;
      return false;
    }
    configured_ = true;
    configuredAt_ = millis();
    lastAttempt_ = 0;
    return true;
#else
    (void)busAlreadyStarted;
    return false;
#endif
  }

  // Call from a student's "Đọc IMU" block; never polls in an ISR.
  // Every call is bounded by Wire's 20 ms timeout, with an >=10 ms sample interval.
  bool sample() {
#if defined(ARDUINO_ARCH_ESP32)
    if (!configured_) return false;
    const uint32_t now = millis();
    if (uint32_t(now - configuredAt_) < 160) return false; // gyro startup time
    if (lastAttempt_ && uint32_t(now - lastAttempt_) < 10) return fresh(now);
    lastAttempt_ = now;
    uint8_t status = 0;
    if (!readRegisters(kStatus0, &status, 1)) { valid_ = false; return false; }
    if ((status & 0x03) != 0x03) return fresh(now); // keep a fresh cached sample
    uint8_t bytes[12]{};
    if (!readRegisters(kAccXLow, bytes, sizeof(bytes))) { valid_ = false; return false; }
    for (unsigned i = 0; i < 6; ++i) {
      const uint16_t raw = uint16_t(bytes[2*i]) | (uint16_t(bytes[2*i+1]) << 8);
      values_[i] = static_cast<int16_t>(raw) / (i < 3 ? kAccelDivisor : kGyroDivisor);
    }
    valid_ = true;
    sampledAt_ = millis();
    return true;
#else
    return false;
#endif
  }

  bool fresh(uint32_t now) const {
    return configured_ && valid_ && uint32_t(now - sampledAt_) <= kFreshMs;
  }
  bool ready() const {
#if defined(ARDUINO_ARCH_ESP32)
    return fresh(millis());
#else
    return false;
#endif
  }
  float value(ImuChannel channel) const {
    const unsigned i = static_cast<unsigned>(channel);
    return i < 6 && ready() ? values_[i] : 0.0f;
  }
 private:
#if defined(ARDUINO_ARCH_ESP32)
  bool writeRegister(uint8_t reg, uint8_t value) {
    Wire.beginTransmission(kAddress);
    Wire.write(reg);
    Wire.write(value);
    return Wire.endTransmission() == 0;
  }
  bool readRegisters(uint8_t reg, uint8_t* result, size_t length) {
    if (!result || !length || length > 16) return false;
    Wire.beginTransmission(kAddress);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) return false;
    const size_t count = Wire.requestFrom(kAddress, uint8_t(length));
    if (count != length) {
      while (Wire.available()) Wire.read();
      return false;
    }
    for (size_t i = 0; i < length; ++i) {
      if (!Wire.available()) return false;
      const int byte = Wire.read();
      if (byte < 0) return false;
      result[i] = uint8_t(byte);
    }
    return true;
  }
#endif
  bool busStarted_ = false, configured_ = false, valid_ = false;
  uint32_t configuredAt_ = 0, lastAttempt_ = 0, sampledAt_ = 0;
  float values_[6]{};
};
} } // namespace codelab::newmania
