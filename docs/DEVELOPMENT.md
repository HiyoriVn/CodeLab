# Development setup

## Firmware toolchain preflight - 2026-11-05

Verified on Windows with Arduino CLI 1.5.1 and installed ESP32 Arduino Core 3.3.7. Set `ARDUINO_DIRECTORIES_DATA` to `C:\Users\Admin\AppData\Local\Arduino15` and `ARDUINO_DIRECTORIES_DOWNLOADS` to its `staging` subdirectory in the current PowerShell process. Do not change IDE/OpenBlockDesktop settings.

Minimal compile passed (exit 0) using `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled` and empty `setup()`/`loop()`. This is a generic “ESP32S3 Dev Module” profile, not validation on the STEAM PCB. See [build log](verification/phase02_1_compile.log) and [progress](PROGRESS.md). No upload was run.

Safe-startup policy for the next board-configuration task: motors/buzzer LOW at initialization; servo outputs DISABLED with no pulses by default. Enabling requires an explicit command and verified power-stable interlock. The documents identify no POWER_GOOD signal; leave enable unavailable until an actual verifiable condition is identified. Keep PS4 UART CSV v1 as the compatibility baseline.

## Hardware audit update - 2026-11-04

The confirmed mainboard is STEAM Robotics V2.0 / ESP32-S3-MINI-1-N8; a dedicated software board profile and pinned firmware toolchain are still missing. The existing generic FQBN below is not hardware acceptance. The PS4 bridge uses mainboard UART1 RX7/TX6; existing RX16/TX17 toolbox defaults collide with servos. The PS4 generator currently fails (`includes_` / `ps4_stdio`); do not use its source presence as proof of working PS4 support. See [audit](PHASE01_AUDIT.md), [hardware](hardware/HARDWARE.md) and [implementation plan](IMPLEMENTATION_PLAN.md). This audit did not run compile/upload or install a firmware toolchain.

## Requirements

- Node.js compatible with Vite 7 and npm.
- A modern desktop browser.
- Arduino CLI.
- Arduino ESP32 core 3.3.7 for the verified generic `esp32:esp32:esp32s3` compile target; board-specific settings remain to validate on the PCB.
- A supported ESP32-S3 board and USB data cable for hardware validation.

## Run the web editor and bridge

From the repository root, install dependencies and run these in separate terminals:

```bash
npm install
npm run dev
```

```bash
npm run bridge
```

Open the Vite URL. Its development server forwards `/api` to the local bridge on `127.0.0.1:8787`.

For standalone local use:

```bash
npm run build
npm run bridge
```

Then open `http://127.0.0.1:8787`. The bridge serves the `dist/` app and its API. It binds only to loopback and invokes Arduino CLI with argument arrays. Set `ARDUINO_CLI_PATH` if the executable is not named `arduino-cli`, `CODELAB_FQBN` to a confirmed target FQBN, or `CODELAB_BRIDGE_PORT` to change the bridge port.

## Compile and upload

1. Install the ESP32 core with Arduino CLI and confirm the board FQBN.
2. Resolve all generator warnings; warnings disable the compile button.
3. Click **Biên dịch** and review any Arduino CLI errors.
4. Select a port detected by Arduino CLI.
5. Click **Nạp lên bo mạch…** and confirm the replacement prompt.

The bridge allows upload only for a successful build in the current session and a currently detected port. Temporary build files expire after 30 minutes. Check wiring, external loads, motor driver, and power before uploading a program that can move hardware.

## PS4 adapter contract

The controller blocks contain the legacy CodeLab UART/I2C frame contract in [PS4 receiver requirements](PS4-RECEIVER.md). The selected V2 bridge integration uses UART1; L1 PS4Bluepad32 needs explicit axis/button conversion and a UART publisher. Keep legacy workspace data intact when implementing the future board profile. The current generator defects must be fixed and compiled before claiming functionality.

## Current source behavior

- Blockly editor with Vietnamese categories, versioned workspace JSON open/save, and browser-local autosave.
- Arduino C++ preview for a subset of built-in control, logic, math, text, and variable blocks.
- Robotics blocks for GPIO, ADC, PWM, delay, and generic H-bridge motor control.
- PS4 adapter blocks for UART/I2C configuration, connection state, four axes, and named buttons.
- The helper's intended behavior is axes normalized to -1000…1000 with neutral accessors after 250 ms. Generation, escaping, strict input validation and robot safety gaps are recorded in the audit.
- Unsupported blocks and diagnostics produce warnings; compile remains disabled while warnings exist.

The source is present on `main`. Limited browser/build checks for the UI integration branch are recorded in [TESTING.md](TESTING.md); Arduino CLI compile, serial upload, receiver parser, and hardware acceptance remain outstanding.

## Contributor workflow

1. Read `AGENTS.md`, `docs/ROADMAP.md`, and relevant architecture/testing sections.
2. Choose a focused acceptance criterion.
3. Work on a topic branch.
4. Run applicable checks when requested and record exact results.
5. Update documentation when implementation or decisions change.
6. Open a PR with scope, verification status, and hardware details where relevant.

## Updated editor and projects

The UI integration branch uses a full-height layout with Code on the right, serial monitor below, and a device dialog. The panels can be opened or closed. Use **Tập tin** to switch browser-local projects, create a project, or import/export `.codelab.json` files. Light/dark mode and menu colors are available. This browser storage is local to the browser profile and should not be treated as a backup; export files for safekeeping or transfer. See [UI-INTEGRATION.md](UI-INTEGRATION.md) for branch provenance.

The serial monitor uses the browser Web Serial API to select a port, read incoming text, and send newline-terminated commands. Browser support and board serial settings must be confirmed on the target setup. UI and serial behavior remain unverified until exercised.
