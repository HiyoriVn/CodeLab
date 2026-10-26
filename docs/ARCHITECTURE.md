# Proposed architecture

The repository contains the React/Vite + Blockly editor, Arduino C++ generator, robotics blocks, and a local Arduino CLI bridge in source. Runtime and hardware verification are still pending.

## Design principles

- Keep the visual workspace independent from target-language generation.
- Make generated Arduino C++ deterministic and reviewable.
- Keep board and peripheral details in explicit profiles/adapters.
- Separate transport from controller semantics so UART/I2C details do not leak into blocks.
- Make actions that affect hardware explicit and recoverable.

## Current source modules

- **Editor UI:** React shell, Blockly workspace, code preview, workspace import/export, and build/device panel.
- **Workspace:** versioned serialized blocks and browser-local draft persistence.
- **Block catalog:** built-in Blockly blocks plus CodeLab GPIO input/output, ADC, PWM, delay, and H-bridge blocks.
- **C++ generator:** subset of control, logic, math, text, variables, and robotics blocks; unsupported blocks and diagnostics are shown as warnings.
- **Local build bridge:** Node.js HTTP service bound to loopback. It calls Arduino CLI without a shell, compiles temporary sketches, enumerates ports, and uploads only a successful build after UI confirmation.
- **Target profile:** currently defaults to generic `esp32:esp32:esp32s3`; board-specific pin maps are not implemented.
- **PS4 receiver:** not implemented. The archive does not identify a receiver or protocol.

All implemented source paths are unverified until the user runs them.

## Data flow

`Workspace → generator → Arduino C++ + diagnostics → local Arduino CLI compile → user-confirmed upload → board`

The local bridge serves the built web app and `/api` on `127.0.0.1:8787`. During web development Vite proxies `/api` to that bridge. Upload requires a valid build ID and a port currently reported by Arduino CLI.

The future PS4 path remains:

`External receiver → documented UART/I2C adapter → normalized state → controller blocks → generated logic`

The receiver does not imply native Bluetooth support on the ESP32-S3. Its exact electrical and protocol contract must be supplied before implementation.

## Boundaries

- UI calls HTTP application services; it does not launch processes or parse receiver frames.
- Generator accepts a Blockly workspace and returns code plus diagnostics.
- Build bridge accepts source text and target configuration, not Blockly objects.
- The bridge uses `spawn` with a fixed executable and argument list; it binds to loopback and has bounded request sizes and temporary build retention.
- Board profiles should validate pin capabilities before generation and choose a known FQBN.
- Receiver adapters should expose connection state, named buttons, axes, and timestamps after module documentation is known.

## Open decisions

- Exact ESP32-S3 board(s), pinout, flash/partition assumptions, and supported host OS matrix.
- Arduino CLI installation/update approach and supported core versions.
- Exact PS4 receiver model, voltage, wiring, UART/I2C settings, packet format, and license.
- Whether desktop packaging is needed after browser MVP feedback.
