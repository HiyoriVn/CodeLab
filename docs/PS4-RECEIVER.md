# PS4 receiver and CodeLab adapter contract

## Mecanum consumer — 2026-11-05

The new [simulation-only RobotController](robotics/PS4_MECANUM.md) consumes this same UART CSV v1 contract. Parser `hasReport()`/`lastReportAt()` expose read-only freshness metadata; they do not refresh the timestamp or change parsing/axes. The controller watchdog uses actual accepted-report age, not repeated accessor reads. Bridge/publisher, CSV schema and250ms boundary are unchanged. Motor/servo remain mocks; no UART or actuator is enabled on the experimental board by this consumer.

This document describes the **legacy CodeLab UART/I2C adapter contract**, not a verified hardware implementation. The selected V2 mainboard architecture uses a separate ESP32 PS4 bridge over UART1 TX GPIO6 / RX GPIO7. Bridge chip/pins/power remain open. UART ASCII CSV v1 below is the selected compatibility baseline. PS4Bluepad32 1.0.1 itself has different axis/button representations and no UART publisher; the new isolated bridge supplies conversion/publication. See [library audit](architecture/PS4_LIBRARY_AUDIT.md).

The 2026-11-05 **A1** update fixes the previously reproduced `includes_ / ps4_stdio` exception and generated LF/CR/NUL escaping. UART generation/parser are software-tested; see [A1 results](verification/PS4_A1_STABILIZATION.md). PS4Bluepad32 1.0.1 / Bluepad32 remain on the separate ESP32. No direct PS4 Bluetooth support is added to ESP32-S3, A2–A4 now add an isolated compile-only Classic ESP32 bridge; hardware remains untested. The separate NewmaniaCodeLab reference archive does not establish this protocol.

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
- A complete LF or CRLF line is accepted only with all six decimal fields in range. Axes allow a leading minus; no plus signs/whitespace/trailing fields/text, embedded NUL, integer overflow or out-of-range values. An overlong line (buffer96 bytes including terminator) is discarded until LF; incomplete lines do not refresh state. CR alone does not terminate a frame.
- Accepted connected=0 immediately clears axes/buttons. Before any valid frame, disconnected, or when elapsed time is greater than250 ms since the last accepted frame, accessors return neutral (0/false). At exactly250 ms, a connected valid frame remains current, preserving the existing boundary. Malformed/empty input does not refresh the deadline; unsigned elapsed time handles millis rollover.
- CSV v1 has no sequence/timestamp/CRC: the receiver cannot tell an actual fresh identical report from stale data replayed as valid CSV. A2 must ensure the publisher emits connected=1 frames only for fresh controller reports; heartbeat alone must not replay cached input as fresh. Rejecting a text heartbeat is tested, but replay protection is not claimed. No v2/binary/I2C switch is implemented.
- Polling occurs at the generated loop preamble for all controller-read blocks. Accessor neutral state is not a robot output safety manager; blocking programs and motor outputs need separate safety work.

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

The existing UART RX16/TX17 defaults conflict with V2 servo3/4 and must not be used as this board's wiring. Mainboard UART1 is RX7/TX6; the generator API orders RX before TX. UART1 header pin 1 is GND, 2 +5V_Core, 3 TX, 4 RX. Cross TX/RX and share GND; do not connect the 5 V pin to an unverified bridge power input. A1 permits the configured UART1 pair for the selected concrete board profile only (V2 RX7/TX6, V1 RX21/TX18), still detecting conflicts with other block pin roles. Wrong concrete-board UART pins remain warnings. Generic preserves explicit user pin selection; no saved workspace pins or toolbox defaults are silently rewritten.

## Hardware information still required

- Bridge chip/model/revision, power input, UART/LED pins and pinned Bluepad32/core version.
- Physical confirmation of the documented V2/N8 mainboard, toolchain and debug USB/UART0 setup.
- Bridge electrical compatibility with 3.3 V signals, final UART baud/protocol and captured packets.
- Pairing/reset behavior, update cadence, reconnect behavior, and desired robot safe state.

Historical web Phase 5 is not hardware-accepted. The new firmware roadmap places PS4 bridge/protocol in Phase 04 and CodeLab migration in Phase 06; full phase acceptance remains open; A1 receiver generation/parsing is separately verified above. Results must be recorded in [the verification plan](TESTING.md) and [progress](PROGRESS.md).

## PS4 A2–A4 — selected bridge contract (2026-11-05)

`firmware/ps4_bridge/MappingPublisher.h` maps library percentages p in[-100,100] to q=`ceil((10*p+1000)*65535/2000)-32768`, with zero encoded0. This inverts the existing Arduino integer map so all201 integer percentages round-trip exactly to10*p (including endpoints-1000/+1000). Invalid percentages fail closed. The library already inverts Y and applies deadzone; bridge preserves Y and does not apply another deadzone. Existing bit table above is the destination: explicitly remap L1 source Share10->8,Options11->9,L3 8->10,R3 9->11,D-pad14..17->13..16; Touchpad13 and unknown source bits are omitted. Analog trigger pressures have no CSV v1 fields; only L2/R2 digital bits survive.

Publisher serializes exactly six decimal fields and LF, no schema/version/CRC/heartbeat changes. It sends a connected frame only on a new report event, accepting identical fresh values. On disconnect/stale>250ms/reset it emits `0,0,0,0,0,0\n` then stops cached connected publication. Busy output is dropped, never queued as stale control. A1 receiver remains unchanged and neutralizes independently on its timeout.

Pinned Bluepad32 SDK4.1.0 exposes `BP32.update()` boolean and per-update `Controller::hasData()`; a thin ReportGate uses that evidence before PS4Bluepad32.getData, rather than assuming every successful cached read is fresh. RESET_MAC inhibits until disconnect is observed. Pairing/MAC persistence/reconnect remain delegated to the library, no Web Pairing/AP/server. Reset application MAC is not bond-key deletion.

[Bridge configuration/pairing](../firmware/ps4_bridge/README.md) and [A2–A4 verification](verification/PS4_FAST_TRACK_A2_A4.md) distinguish compile-only candidate `esp32-bluepad32:esp32:esp32` core4.1.0 from mainboard S3 core3.3.7. Final bridge TX/RX/LED/board/power remain unconfirmed; default UART/LED disabled. SOFTWARE_ACCEPTED applies only to tested pure software and candidate compile, not hardware/pairing. A5 remains deferred.
