#pragma once
#include <stdint.h>
#include <stddef.h>
#include "I2CFrame.h"
#include "I2CReceiver.h"

namespace codelab { namespace ps4i2c {

constexpr uint8_t uartHeader0 = 0xA5;
constexpr uint8_t uartHeader1 = 0x5A;
constexpr uint32_t uartBaud = 115200;
constexpr int8_t uartRxPin = 8;
constexpr int8_t uartTxPin = 9;
constexpr size_t uartPacketSize = 2 + frameSize + 1;

inline uint8_t crc8(const uint8_t* data, size_t len) {
  uint8_t crc = 0x00;
  for (size_t i = 0; i < len; ++i) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x80) ? uint8_t((crc << 1) ^ 0x07) : uint8_t(crc << 1);
    }
  }
  return crc;
}

inline void encodeUartPacket(const Frame& f, uint8_t (&packet)[uartPacketSize]) {
  packet[0] = uartHeader0;
  packet[1] = uartHeader1;
  uint8_t payload[frameSize];
  encode(f, payload);
  for (size_t i = 0; i < frameSize; ++i) packet[2 + i] = payload[i];
  packet[2 + frameSize] = crc8(payload, frameSize);
}

class UartParser {
  enum class State : uint8_t { WaitHeader0, WaitHeader1, Payload, Crc };
  State state_ = State::WaitHeader0;
  uint8_t payload_[frameSize] = {};
  size_t index_ = 0;

 public:
  uint32_t packets = 0;
  uint32_t crcErrors = 0;

  void reset() {
    state_ = State::WaitHeader0;
    index_ = 0;
  }

  bool feed(uint8_t byte, Receiver& receiver, uint32_t now) {
    switch (state_) {
      case State::WaitHeader0:
        if (byte == uartHeader0) state_ = State::WaitHeader1;
        return false;
      case State::WaitHeader1:
        if (byte == uartHeader1) {
          index_ = 0;
          state_ = State::Payload;
        } else if (byte != uartHeader0) {
          state_ = State::WaitHeader0;
        }
        return false;
      case State::Payload:
        payload_[index_++] = byte;
        if (index_ >= frameSize) state_ = State::Crc;
        return false;
      case State::Crc:
        if (crc8(payload_, frameSize) == byte) {
          ++packets;
          state_ = State::WaitHeader0;
          return receiver.ingest(payload_, frameSize, now);
        }
        ++crcErrors;
        state_ = (byte == uartHeader0) ? State::WaitHeader1 : State::WaitHeader0;
        return false;
    }
    return false;
  }
};

} }
