#pragma once
#include <stdint.h>
#include <stddef.h>

namespace codelab {
namespace board {
struct Pair { uint8_t first; uint8_t second; };
constexpr Pair motors[] = {{42,41},{40,39},{38,37},{36,35},{48,34},{33,47}};
constexpr uint8_t servos[] = {14,15,16,17,18,21};
constexpr Pair encoders[] = {{1,2},{4,5}};
constexpr uint8_t i2cSda=8, i2cScl=9, imuAddress=0x6A;
constexpr uint8_t uart1Tx=6, uart1Rx=7, uart0Tx=43, uart0Rx=44;
constexpr uint8_t spiSck=12, spiMosi=11, spiMiso=13, spiCs=10;
constexpr uint8_t buzzer=26, usbDm=19, usbDp=20, boot=0;
constexpr uint8_t expansion[] = {3,46,45,uart1Tx,uart1Rx,spiCs};
constexpr uint8_t strapping[] = {0,3,45,46};
// Unique physical nets only. Expansion bus aliases intentionally omitted.
constexpr uint8_t reserved[] = {
  motors[0].first,motors[0].second,motors[1].first,motors[1].second,
  motors[2].first,motors[2].second,motors[3].first,motors[3].second,
  motors[4].first,motors[4].second,motors[5].first,motors[5].second,
  servos[0],servos[1],servos[2],servos[3],servos[4],servos[5],
  encoders[0].first,encoders[0].second,encoders[1].first,encoders[1].second,
  i2cSda,i2cScl,uart1Tx,uart1Rx,uart0Tx,uart0Rx,spiSck,spiMosi,spiMiso,spiCs,
  buzzer,usbDm,usbDp,boot,expansion[0],expansion[1],expansion[2]
};
constexpr bool validMap() {
  for (size_t i=0;i<sizeof(reserved);++i) {
    const auto pin=reserved[i];
    if (!(pin<=21 || pin==26 || (pin>=33 && pin<=48))) return false;
    for (size_t j=0;j<i;++j) if (pin==reserved[j]) return false;
  }
  return sizeof(reserved)==39;
}
static_assert(validMap(), "Invalid or overlapping mainboard pin reservation");
static_assert(sizeof(motors)/sizeof(Pair)==6 && sizeof(servos)==6, "Channel count mismatch");
} // namespace board
} // namespace codelab
