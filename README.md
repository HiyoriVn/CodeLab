# CodeLab

CodeLab is a browser-first visual programming environment for ESP32-S3 robotics. It uses Blockly-style blocks to generate Arduino C++.

## Product decisions

- MVP mainboard: STEAM Robotics Mainboard V2.0, ESP32-S3-MINI-1-N8. The accepted native BoardConfig/SafeStartup and web board profile are present; hardware validation remains pending. Newmania Starter V1.0 (ESP32-S3-WROOM-1-N8R2) is the additional hardware test board.
- MVP language: Arduino C++; MicroPython is out of scope.
- Web stack: React, Vite, and Blockly.
- PS4 controller: a separate ESP32 handles the controller and forwards state over mainboard UART1 (TX GPIO6, RX GPIO7). The bridge chip, bridge pins/power input, toolchain and wire protocol still need confirmation. Legacy UART/I2C blocks remain in source; the selected board integration uses UART1.

## Current status

The audited local checkout contains the Blockly editor and workspace persistence, a subset of Arduino C++ generation, GPIO/ADC/PWM/delay/H-bridge blocks, a local Arduino CLI compile/upload flow, and PS4 adapter source. The production web build passed on 2026-11-04, and earlier limited UI checks are recorded in the testing document. Minimal V2 and six V1 generated examples have now been Arduino-compiled; upload and hardware acceptance remain unverified. PS4 A1 fixes the previously reproduced `includes_` / `ps4_stdio` and escaping errors; the generated UART CSV v1 receiver has host regression tests and an actual S3 compile. Bridge mapping/publisher and a Bluepad32-core Classic ESP32 compile-only candidate now exist; actual pairing/hardware verification remains pending; see [A1 results](docs/verification/PS4_A1_STABILIZATION.md).

The hardware/firmware Phase 01 audit is documented in [the report](docs/PHASE01_AUDIT.md) and [progress tracker](docs/PROGRESS.md). Two supplied PDFs establish the board pinout; the supplied PS4Bluepad32 1.0.1 ZIP is the selected external dependency for the isolated bridge candidate, without vendoring its source. V2 safe-startup firmware and independent V1 test sketches now exist; PS4 bridge has an isolated compile-only candidate with UART/LED unassigned by default; see [A2–A4 results](docs/verification/PS4_FAST_TRACK_A2_A4.md). See [multi-board profiles](docs/boards/BOARD_PROFILES.md), [V1 hardware test guide](docs/boards/V1_HARDWARE_TEST.md), and [fast-track results](docs/verification/NEWMANIA_V1_FAST_TRACK.md).

See the [hardware baseline](docs/hardware/HARDWARE.md), [pinout](docs/hardware/PINOUT.md), [proposed firmware architecture](docs/architecture/ARCHITECTURE.md), [module gaps](docs/architecture/MODULES.md), [Phase 02-07 plan](docs/IMPLEMENTATION_PLAN.md), [web architecture](docs/ARCHITECTURE.md), [development setup](docs/DEVELOPMENT.md), [verification plan](docs/TESTING.md), and [legacy PS4 contract](docs/PS4-RECEIVER.md). The [historical web roadmap](docs/ROADMAP.md) uses a separate phase numbering scheme. Previously referenced `docs/EXAMPLES.md` and `docs/TROUBLESHOOTING.md` are absent; they remain planned deliverables.

The physical Newmania unit under test reports16MB flash/8MB Octal PSRAM, differing from the documented N8R2. An explicitly authorized experimental LED47/USB Serial profile is available; the original profiles remain unchanged. Do not use N8R2 motor-startup examples on this Octal unit. See [actual hardware results and restrictions](docs/verification/V1_HARDWARE_INTEGRATION.md).

## Run locally

PS4 mecanum logic is available as a portable C++ library with host mocks, latched faults and a disabled-by-default logical servo. It does not drive motors/servos on the experimental board. See [simulation/API/wiring gates](docs/robotics/PS4_MECANUM.md).

Robotics blocks now use board capabilities and logical motor/servo channels. Digital/ADC/PWM/Serial generation and servo signal disable have software tests; motor motion and servo enable remain blocked. See [supported examples, compiler evidence and limitations](docs/verification/ROBOTICS_BLOCKS_INTEGRATION.md). Hardware acceptance remains pending.

For editor development, use `npm install`, then run `npm run dev` and `npm run bridge` in separate terminals. The bridge requires Arduino CLI and the ESP32 core.

For a standalone local build, run `npm run build` followed by `npm run bridge`, then open `http://127.0.0.1:8787`. Upload requires a successful compile, a currently detected serial port, and explicit confirmation.

## Reference archive

NewmaniaCodeLab is a separate design reference, not the CodeLab repository. Its README and source describe a Blockly app and Python generator; they do not define CodeLab's PS4 receiver protocol. See [reference baseline](docs/REFERENCE-BASELINE.md).

## Status labels

- **Implemented in source, unverified:** code exists in the repository, but behavior has not been exercised.
- **Verified:** tested in this repository with evidence recorded.
- **Adapter contract:** CodeLab-defined input format; actual receiver compatibility must be confirmed.
- **Planned:** not yet present in source.

The integration branch includes Bách's refreshed editor, light/dark mode, menu colors, a right-side code preview, a bottom serial panel, and a device dialog. Use **Tập tin** to switch between browser-local projects or import/export files. Projects remain in the current browser profile unless exported. The serial monitor uses Web Serial where supported. See [UI integration](docs/UI-INTEGRATION.md) for provenance and verification limits.
