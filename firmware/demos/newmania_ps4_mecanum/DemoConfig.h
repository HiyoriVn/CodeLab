#pragma once

// Proposed rewire authorized by owner, NOT the current I2C connection:
// D1 TX GPIO21 -> S3 RX GPIO21, D1 RX GPIO22 <- S3 TX GPIO18, common GND.
// S3 pins come from supplied reference schematic; physical rewire still pending.
// Not a replacement board profile; keep wiring-confirmed false until checked.
#ifndef CODELAB_DEMO_UART_RX
#define CODELAB_DEMO_UART_RX 21
#endif
#ifndef CODELAB_DEMO_UART_TX
#define CODELAB_DEMO_UART_TX 18
#endif
#ifndef CODELAB_DEMO_UART_WIRING_CONFIRMED
#define CODELAB_DEMO_UART_WIRING_CONFIRMED 0
#endif
namespace demo {
constexpr int rx=CODELAB_DEMO_UART_RX, tx=CODELAB_DEMO_UART_TX;
constexpr bool wiringConfirmed=CODELAB_DEMO_UART_WIRING_CONFIRMED!=0;
// Reject Octal memory, USB, strapping, LED and provisional old onboard load pins.
// Passing this check does NOT prove a pin is wired to the actual UART header.
constexpr bool uartCandidate(int pin) {
  return pin==1||pin==2||(pin>=4&&pin<=11)||pin==16||pin==18||pin==21
    ||pin==43||pin==44||pin==48;
}
constexpr bool validUart(int r,int t) { return uartCandidate(r)&&uartCandidate(t)&&r!=t; }
constexpr bool uartEnabled=wiringConfirmed&&validUart(rx,tx);
static_assert(rx==-1||uartCandidate(rx),"RX conflicts with memory/USB/strapping/load pins");
static_assert(tx==-1||uartCandidate(tx),"TX conflicts with memory/USB/strapping/load pins");
static_assert(!wiringConfirmed||validUart(rx,tx),"Confirm both actual UART pins, distinct and safe");
constexpr unsigned baud=115200;
// Physical drivers cannot be enabled by a runtime command or guessed pin pair.
constexpr bool hardwareMotorsEnabled=false,hardwareServoEnabled=false;
}
