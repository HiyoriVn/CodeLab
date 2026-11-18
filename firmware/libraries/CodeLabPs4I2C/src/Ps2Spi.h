#pragma once
// Newmania V2 PS2 receiver, independent implementation of the standard
// PlayStation 2 synchronous controller protocol. No third-party PS2X code.
// Board wiring: CLK=12, CMD=11, DAT=13, ATT=10; 3.3 V logic only.
#include <stdint.h>
#include <stddef.h>
#include "I2CFrame.h"
#if defined(ARDUINO_ARCH_ESP32)
#include <Arduino.h>
#endif

namespace codelab { namespace ps4i2c {

inline int16_t ps2Percent(uint8_t raw, bool vertical) {
  const int32_t centered = vertical ? (127 - int32_t(raw)) : (int32_t(raw) - 128);
  int32_t percent = centered < 0 ? centered * 100 / 128 : centered * 100 / 127;
  if (percent < -100) percent = -100;
  if (percent > 100) percent = 100;
  return percent >= -6 && percent <= 6 ? 0 : int16_t(percent);
}

// PS2's 16-bit button word is active-low; CodeLab button bits are active-high.
// A valid analog response has FF, 73/79, 5A at offsets 0..2.
inline bool decodePs2Analog(const uint8_t* packet, size_t count, Frame& out) {
  out = {};
  if (!packet || count < 9 || packet[0] != 0xff ||
      (packet[1] != 0x73 && packet[1] != 0x79) || packet[2] != 0x5a) return false;
  const uint16_t pressed = uint16_t(~(uint16_t(packet[3]) | (uint16_t(packet[4]) << 8)));
  struct Mapping { uint16_t from; uint8_t to; };
  static constexpr Mapping buttons[] = {
    {1U<<14,0}, {1U<<13,1}, {1U<<15,2}, {1U<<12,3}, // Cross/Circle/Square/Triangle
    {1U<<10,4}, {1U<<11,5}, {1U<<8,6}, {1U<<9,7},  // L1/R1/L2/R2
    {1U<<0,8}, {1U<<3,9}, {1U<<1,10}, {1U<<2,11}, // Select/Start/L3/R3
    {1U<<4,13}, {1U<<6,14}, {1U<<7,15}, {1U<<5,16}, // D-pad
  };
  for (const auto& mapping : buttons)
    if (pressed & mapping.from) out.buttons |= (1UL << mapping.to);
  // PS2 packet offsets: RX=5, RY=6, LX=7, LY=8.
  out.axes[0] = ps4bridge::axis(ps2Percent(packet[7], false));
  out.axes[1] = ps4bridge::axis(ps2Percent(packet[8], true));
  out.axes[2] = ps4bridge::axis(ps2Percent(packet[5], false));
  out.axes[3] = ps4bridge::axis(ps2Percent(packet[6], true));
  out.connected = true;
  return true;
}

class Ps2Spi {
 public:
  enum class Result : uint8_t { Skipped, Valid, Invalid };
 private:
  static constexpr uint8_t kClock = 12, kCommand = 11, kData = 13, kAttention = 10;
  uint32_t lastPoll_ = 0, lastConfig_ = 0;
  bool started_ = false;

#if defined(ARDUINO_ARCH_ESP32)
  uint8_t shift(uint8_t outbound) {
    uint8_t incoming = 0;
    for (uint8_t bit = 0; bit != 8; ++bit) {
      digitalWrite(kCommand, (outbound & (1U << bit)) ? HIGH : LOW);
      digitalWrite(kClock, LOW);
      delayMicroseconds(2);
      if (digitalRead(kData)) incoming |= uint8_t(1U << bit);
      digitalWrite(kClock, HIGH);
      delayMicroseconds(2);
    }
    digitalWrite(kCommand, HIGH);
    delayMicroseconds(10);
    return incoming;
  }
  void transfer(const uint8_t* tx, uint8_t* rx, size_t len) {
    digitalWrite(kAttention, LOW);
    delayMicroseconds(10);
    for (size_t i = 0; i < len; ++i) {
      const uint8_t received = shift(tx[i]);
      if (rx) rx[i] = received;
    }
    digitalWrite(kAttention, HIGH);
    delayMicroseconds(10);
  }
  void configure() {
    // Enter configuration, select analog mode, exit configuration.
    static constexpr uint8_t enter[] = {0x01,0x43,0x00,0x01,0x00,0,0,0,0};
    static constexpr uint8_t analog[] = {0x01,0x44,0x00,0x01,0x03,0,0,0,0};
    static constexpr uint8_t exit[] = {0x01,0x43,0x00,0x00,0x5a,0x5a,0x5a,0x5a,0x5a};
    transfer(enter, nullptr, sizeof(enter));
    delay(2);
    transfer(analog, nullptr, sizeof(analog));
    delay(2);
    transfer(exit, nullptr, sizeof(exit));
    lastConfig_ = millis();
  }
#endif
 public:
  bool begin() {
#if defined(ARDUINO_ARCH_ESP32)
    pinMode(kClock, OUTPUT); pinMode(kCommand, OUTPUT); pinMode(kAttention, OUTPUT);
    pinMode(kData, INPUT_PULLUP);
    digitalWrite(kClock, HIGH); digitalWrite(kCommand, HIGH); digitalWrite(kAttention, HIGH);
    started_ = true;
    configure();
    return true;
#else
    return false; // Host mocks never touch physical PS2 pins.
#endif
  }
  Result poll(uint32_t now, Frame& frame) {
    if (!started_ || uint32_t(now - lastPoll_) < 16) return Result::Skipped;
    lastPoll_ = now;
#if defined(ARDUINO_ARCH_ESP32)
    static constexpr uint8_t request[] = {0x01,0x42,0x00,0,0,0,0,0,0};
    uint8_t response[sizeof(request)] = {};
    transfer(request, response, sizeof(request));
    if (decodePs2Analog(response, sizeof(response), frame)) return Result::Valid;
    if (uint32_t(now - lastConfig_) >= 1000) configure();
    frame = {};
    return Result::Invalid;
#else
    frame = {};
    return Result::Invalid;
#endif
  }
};
} } // namespace codelab::ps4i2c
