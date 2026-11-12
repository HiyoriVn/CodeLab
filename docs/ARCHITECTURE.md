# Architecture

CodeLab is a browser-first React/Vite + Blockly editor that generates Arduino C++ for ESP32-S3. This page describes the existing web application and legacy adapter design. The 2026-11-04 [audit](PHASE01_AUDIT.md) records a passing web build, limited historical UI checks, and a reproduced PS4 generator error; hardware verification remains outstanding. The [new firmware architecture](architecture/ARCHITECTURE.md) is a proposal, not implemented code.

## Scratch-first editor — 2026-11-06

`src/blocks/beginner.js` adds new IDs alongside legacy registrations; `beginner-toolbox.js` builds mode/profile-specific categories. Optional `project.editorMode` is persisted/exported by App; no metadata means Advanced for legacy compatibility. BlocklyWorkspace updates the toolbox in place. The Arduino generator adds setup-only events, loop bodies and explicit PS4 simulation alongside unchanged UART helpers; unsupported actuator requests return diagnostics consumed by the existing compile gate. New lessons are version1 JSON plus deterministic C++ in `examples/beginner`. [Details](SCRATCH_FIRST.md). The historical audit descriptions below retain their original context; this section describes Issue22 only.

## Modules

- **Editor UI:** Blockly workspace, code preview, workspace import/export, and build/device panel.
- **Generator:** supported Blockly and robotics blocks produce Arduino C++ plus diagnostics.
- **Local build bridge:** loopback Node.js service invokes Arduino CLI with argument arrays, keeps successful builds temporarily, lists connected ports, and requires explicit confirmation before upload.
- **Controller adapter:** helper source is intended to poll a single UART or I2C input, normalize four axes and a button bitmask, and return neutral/disconnected values after stale data. Generation currently fails on `includes_`; the helper also has escaping and validation defects recorded in the audit. This is not a verified receiver.
- **Board profile:** defaults to generic ESP32-S3 FQBN; board-specific pin maps are not implemented.

## Data flow

`Workspace → Arduino C++ + diagnostics → local Arduino CLI compile → user-confirmed upload → ESP32-S3`

Controller data flows:

`PS4 receiver → optional translating adapter → CodeLab UART/I2C frame → normalized controller state → Blockly expressions`

The receiver may not emit this contract directly. Confirm the selected hardware, electrical levels, and protocol before claiming module compatibility.

## PS4 CodeLab adapter contract

UART mode reads newline-delimited ASCII CSV:
`connected,lx,ly,rx,ry,buttons\n`

- `connected`: 0 or 1.
- `lx`, `ly`, `rx`, `ry`: signed 16-bit axis values.
- `buttons`: unsigned 32-bit decimal bitmask.
- The default baud is 115200; the block allows a different rate.
- Intended timeout is 250 ms without an accepted frame. The source checks six parsed fields and end-of-line, but does not strictly validate their documented ranges; this is a known gap, not verified safe-state behavior.

I2C mode makes the ESP32-S3 the bus master and requests 13 bytes from the configured 7-bit receiver address:

- byte 0: connected in bit 0;
- bytes 1–8: four signed 16-bit little-endian axes in LX, LY, RX, RY order;
- bytes 9–12: unsigned 32-bit little-endian button mask.

Axes are normalized to -1000…1000. When disconnected or stale, axis reads return 0 and button reads return false. Button assignments are documented in [PS4 receiver requirements](PS4-RECEIVER.md).

## Boundaries

- UI calls local HTTP APIs; it does not spawn compiler processes or parse receiver frames.
- The generator accepts a Blockly workspace and produces code/diagnostics.
- The bridge accepts source text and target settings, not Blockly objects.
- The external ESP32 bridge is selected as the receiver architecture; its chip/power/pins are still unknown. The supplied PS4Bluepad32 source remains outside CodeLab, and the two firmware targets are planned.
- Upload is only available after a successful compile and user confirmation.

## Confirmed hardware decision and open work

STEAM Robotics Mainboard V2.0 uses ESP32-S3-MINI-1-N8. PS4 data enters UART1: TX6/RX7, header GND/+5V_Core/TX/RX. Cross TX/RX, use 3.3 V logic and common ground, and do not assume +5V_Core can power the bridge. The existing UART16/17 toolbox defaults collide with servo3/4 on this board. See [hardware sources](hardware/HARDWARE.md) and [pinout](hardware/PINOUT.md). Legacy I2C PS4 support remains source only; it is not the chosen bridge transport.

- Exact mainboard toolchain/FQBN/USB configuration and supported operating systems.
- Bridge chip/board, bridge-side wiring/power, toolchain and versioned protocol with axis/button conversion.
- Implementation and verification of the two firmware targets, driver resources and safety policy.
- Desktop packaging after web MVP feedback.

[Static Pages / browser USB flow](CLOUDFLARE_PAGES.md) — precompiled packages only; Arduino CLI compilation remains separate.
