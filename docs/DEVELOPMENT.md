# Development setup

## Requirements

- Node.js compatible with Vite 7 and npm.
- A modern desktop browser.
- Arduino CLI.
- Arduino ESP32 core 3.x for the default `esp32:esp32:esp32s3` target.
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

The controller blocks use the CodeLab UART/I2C frame contract in [PS4 receiver requirements](PS4-RECEIVER.md). GPIO defaults are examples and must be checked against the selected board. A receiver with a different protocol needs a translating adapter. Do not treat the generic contract as verified support for a particular receiver.

## Current source behavior

- Blockly editor with Vietnamese categories, versioned workspace JSON open/save, and browser-local autosave.
- Arduino C++ preview for a subset of built-in control, logic, math, text, and variable blocks.
- Robotics blocks for GPIO, ADC, PWM, delay, and generic H-bridge motor control.
- PS4 adapter blocks for UART/I2C configuration, connection state, four axes, and named buttons.
- The generated adapter normalizes axes to -1000…1000 and returns neutral state when no valid frame arrives for 250 ms.
- Unsupported blocks and diagnostics produce warnings; compile remains disabled while warnings exist.

The source is present on `main` and remains **unverified**. No browser, Arduino CLI compile, serial upload, receiver parser, or hardware test has been run.

## Contributor workflow

1. Read `AGENTS.md`, `docs/ROADMAP.md`, and relevant architecture/testing sections.
2. Choose a focused acceptance criterion.
3. Work on a topic branch.
4. Run applicable checks when requested and record exact results.
5. Update documentation when implementation or decisions change.
6. Open a PR with scope, verification status, and hardware details where relevant.

## Updated editor and projects

The editor now uses a full-height studio layout with Code, serial monitor, and device panels on the right. The panels can be selected or collapsed. Projects are held in the current browser profile and can be exported as `.codelab.json` files or imported from CodeLab project/workspace files. This browser storage is local to the browser profile and should not be treated as a backup; export files for safekeeping or transfer.

The serial monitor uses the browser Web Serial API to select a port, read incoming text, and send newline-terminated commands. Browser support and board serial settings must be confirmed on the target setup. UI and serial behavior remain unverified until exercised.
