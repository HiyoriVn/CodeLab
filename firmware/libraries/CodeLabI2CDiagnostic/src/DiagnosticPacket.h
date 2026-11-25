#pragma once
#include <stdint.h>
#include <stddef.h>

namespace codelab { namespace i2cdiag {
constexpr uint8_t address = 0x30;
constexpr size_t packetSize = 8;
// Request: A5, sequence, 10, 20, 30, 40, 50, XOR of preceding bytes.
// Reply:   5A, sequence, echoed payload, XOR. 00 marks idle/invalid request.
inline uint8_t checksum(const uint8_t* bytes) {
  uint8_t value = 0;
  for (size_t i = 0; i < packetSize - 1; ++i) value ^= bytes[i];
  return value;
}
inline void request(uint8_t sequence, uint8_t* bytes) {
  bytes[0] = 0xA5; bytes[1] = sequence;
  for (size_t i = 2; i < packetSize - 1; ++i) bytes[i] = uint8_t((i - 1) * 0x10);
  bytes[packetSize - 1] = checksum(bytes);
}
inline bool reply(const uint8_t* input, size_t count, uint8_t* output) {
  for (size_t i = 0; i < packetSize; ++i) output[i] = 0;
  if (count != packetSize || input[0] != 0xA5 || input[7] != checksum(input)) return false;
  for (size_t i = 1; i < packetSize - 1; ++i) output[i] = input[i];
  output[0] = 0x5A; output[7] = checksum(output);
  return true;
}
inline bool matches(const uint8_t* input, size_t count, const uint8_t* sent) {
  if (count != packetSize || input[0] != 0x5A || input[7] != checksum(input)) return false;
  for (size_t i = 1; i < packetSize - 1; ++i) if (input[i] != sent[i]) return false;
  return true;
}
} }
