# PS4 receiver and CodeLab adapter contract

This document describes the **legacy CodeLab UART/I2C adapter contract**, not a verified hardware implementation. The selected V2 mainboard architecture uses a separate ESP32 PS4 bridge over UART1 TX GPIO6 / RX GPIO7. Bridge chip/pins/power and the final protocol remain open. The supplied PS4Bluepad32 1.0.1 library has different axis and button representations and no UART publisher; see [library audit](architecture/PS4_LIBRARY_AUDIT.md).

The 2026-11-04 audit reproduced a generator failure (`includes_` / `ps4_stdio`) and helper escaping defects. The field rules below describe the intended legacy contract; current source does not fully enforce them and has not been Arduino-compiled or hardware-tested. The separate NewmaniaCodeLab reference archive does not establish this protocol.

## CodeLab UART frame

The ESP32-S3 UART receiver expects one newline-delimited ASCII CSV record:

```text
connected,lx,ly,rx,ry,buttons
```

- `connected` is 0 or 1.
- `lx`, `ly`, `rx`, `ry` are signed 16-bit integer axes from -32768 to 32767.
- `buttons` is an unsigned 32-bit decimal bitmask.
- Default baud is 115200; the Blockly configuration allows another baud.
- Fields are comma-separated and the record ends with LF or CR/LF.
- Intended behavior: a complete valid record refreshes state; no valid record for 250 ms yields disconnected/neutral accessors. Current `sscanf` checks field count and trailing content but accepts connected values other than 0/1 and clamps axes. Strict validation and robot output safety remain missing.

## CodeLab I2C frame

The ESP32-S3 acts as I2C master and requests 13 bytes from the configured 7-bit receiver address:

| Byte(s) | Meaning |
|---|---|
| 0 | Connection flag; bit 0 set means connected |
| 1–2 | LX, signed 16-bit little-endian |
| 3–4 | LY, signed 16-bit little-endian |
| 5–6 | RX, signed 16-bit little-endian |
| 7–8 | RY, signed 16-bit little-endian |
| 9–12 | Button mask, unsigned 32-bit little-endian |

The legacy Blockly default address is decimal 48 (0x30), not a confirmed device address. Freshness cannot be inferred from receiving 13 bytes: the current decoder refreshes its timestamp even for repeated stale data. The board's QMI8658B is separately documented at 0x6A on SDA8/SCL9; PS4 integration is selected for UART1, not this I2C bus.

## Button bit assignments

| Bit | Button | Bit | Button |
|---:|---|---:|---|
| 0 | Cross | 1 | Circle |
| 2 | Square | 3 | Triangle |
| 4 | L1 | 5 | R1 |
| 6 | L2 | 7 | R2 |
| 8 | Share | 9 | Options |
| 10 | L3 | 11 | R3 |
| 12 | PS | 13 | D-pad up |
| 14 | D-pad down | 15 | D-pad left |
| 16 | D-pad right | | |

Blockly axis values are normalized to -1000…1000. The connected block becomes false after a 250 ms frame timeout; axis reads then return 0 and buttons return false.

## Compatibility and wiring

A receiver that uses a different packet format needs a firmware adapter or a separate translating device that emits the CodeLab contract. No automatic discovery or vendor-specific driver is included until the receiver is identified.

Before connecting hardware, confirm the ESP32-S3 board pinout, receiver voltage levels, common ground, UART direction or I2C roles, and address/baud from the receiver documentation. Do not connect 5 V logic directly to ESP32-S3 GPIO.

The existing UART RX16/TX17 defaults conflict with V2 servo3/4 and must not be used as this board's wiring. Mainboard UART1 is RX7/TX6; the generator API orders RX before TX. UART1 header pin 1 is GND, 2 +5V_Core, 3 TX, 4 RX. Cross TX/RX and share GND; do not connect the 5 V pin to an unverified bridge power input. Generator chip warnings are not a board-specific ownership model.

## Hardware information still required

- Bridge chip/model/revision, power input, UART/LED pins and pinned Bluepad32/core version.
- Physical confirmation of the documented V2/N8 mainboard, toolchain and debug USB/UART0 setup.
- Bridge electrical compatibility with 3.3 V signals, final UART baud/protocol and captured packets.
- Pairing/reset behavior, update cadence, reconnect behavior, and desired robot safe state.

Historical web Phase 5 is not hardware-accepted. The new firmware roadmap places PS4 bridge/protocol in Phase 04 and CodeLab migration in Phase 06; both remain unstarted. Results must be recorded in [the verification plan](TESTING.md) and [progress](PROGRESS.md).
