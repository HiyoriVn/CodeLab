# PS4 receiver and CodeLab adapter contract

CodeLab supports controller inputs through the user's external PS4 receiver over UART or I2C. The supplied NewmaniaCodeLab archive does not identify a PS4 receiver or its protocol. This document specifies the input contract used by the generated CodeLab adapter; it does not claim that an unknown module emits this format.

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
- A complete valid record refreshes the controller state. No valid record for 250 ms yields disconnected state, zero axes, and false buttons.

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

The default Blockly address is decimal 48 (0x30). Change it to the receiver's documented address. The receiver must provide a fresh frame in response to each read; stale/no data becomes disconnected after 250 ms.

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

The chosen UART/I2C GPIO defaults are editable examples only and must be checked against the exact board. The generator reports chip-level risks and pin-role conflicts, but it does not know every board's exposed pins.

## Hardware information still required

- Receiver model/revision and firmware, plus official data sheet or protocol document.
- Board model/revision and pinout.
- Logic voltage, wiring, UART baud or I2C address, and actual packet examples.
- Pairing/reset behavior, update cadence, reconnect behavior, and desired robot safe state.

Phase 5 is not hardware-accepted until the contract is exercised with the exact receiver or translator and results are recorded in [the verification plan](TESTING.md).
