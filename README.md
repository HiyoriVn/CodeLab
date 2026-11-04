# CodeLab

CodeLab is a browser-first visual programming environment for ESP32-S3 robotics. It uses Blockly-style blocks to generate Arduino C++.

## Product decisions

- MVP mainboard: STEAM Robotics Mainboard V2.0, ESP32-S3-MINI-1-N8. Hardware mapping is documented; its software board profile is still planned.
- MVP language: Arduino C++; MicroPython is out of scope.
- Web stack: React, Vite, and Blockly.
- PS4 controller: a separate ESP32 handles the controller and forwards state over mainboard UART1 (TX GPIO6, RX GPIO7). The bridge chip, bridge pins/power input, toolchain and wire protocol still need confirmation. Legacy UART/I2C blocks remain in source; the selected board integration uses UART1.

## Current status

The audited local checkout contains the Blockly editor and workspace persistence, a subset of Arduino C++ generation, GPIO/ADC/PWM/delay/H-bridge blocks, a local Arduino CLI compile/upload flow, and PS4 adapter source. The production web build passed on 2026-11-04, and earlier limited UI checks are recorded in the testing document. Arduino compilation, upload and hardware acceptance remain unverified. Headless audit reproduced a PS4 code-generation error (`includes_` / `ps4_stdio`); web bundling does not establish PS4 functionality.

The hardware/firmware Phase 01 audit is documented in [the report](docs/PHASE01_AUDIT.md) and [progress tracker](docs/PROGRESS.md). Two supplied PDFs establish the board pinout; the supplied PS4Bluepad32 1.0.1 ZIP is an external candidate library, not integrated bridge firmware. No mainboard or PS4 bridge firmware target exists yet. Phase 02 has not started.

See the [hardware baseline](docs/hardware/HARDWARE.md), [pinout](docs/hardware/PINOUT.md), [proposed firmware architecture](docs/architecture/ARCHITECTURE.md), [module gaps](docs/architecture/MODULES.md), [Phase 02-07 plan](docs/IMPLEMENTATION_PLAN.md), [web architecture](docs/ARCHITECTURE.md), [development setup](docs/DEVELOPMENT.md), [verification plan](docs/TESTING.md), and [legacy PS4 contract](docs/PS4-RECEIVER.md). The [historical web roadmap](docs/ROADMAP.md) uses a separate phase numbering scheme. Previously referenced `docs/EXAMPLES.md` and `docs/TROUBLESHOOTING.md` are absent; they remain planned deliverables.

## Run locally

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
