# Proposed architecture

The Phase 1 branch introduces the web app shell and Blockly workspace. Other components below remain target architecture, not implemented functionality.

## Design principles

- Keep the visual workspace independent from target-language generation.
- Make generated Arduino C++ deterministic and reviewable.
- Keep board and peripheral details in explicit profiles/adapters.
- Separate transport from controller semantics so UART/I2C protocol details do not leak into blocks.
- Make actions that affect hardware explicit and recoverable.

## Current Phase 1 scaffold

- **Web shell:** React + Vite entry point and responsive editor layout.
- **Blockly workspace:** built-in blocks, Vietnamese locale, versioned workspace JSON import/export, and browser-local draft persistence.
- **Not present yet:** Arduino C++ generation, board profiles, compiler, upload service, native desktop shell, and PS4 protocol implementation.

The current scaffold is on `feat/phase-1-editor-shell` and has not yet been run or verified.

## Target logical components

1. **Editor UI** — block workspace, toolbox, code preview, project open/save, device and compile/upload status.
2. **Workspace model** — versioned serialized blocks, validation, examples, and migration.
3. **Block catalog** — typed definitions, categories, constraints, help text, and target support metadata.
4. **C++ generator** — converts validated workspace into normalized intermediate representation and Arduino C++ output; reports unsupported blocks and source locations.
5. **Target profile** — ESP32-S3 board identity, framework/toolchain version, pin capabilities, and compile/upload configuration.
6. **Build/deploy service** — compiles, reports diagnostics, selects a device/port, and uploads only after explicit confirmation.
7. **Device transport** — USB serial/board connection and lifecycle, isolated from UI and generation.
8. **Peripheral adapters** — motor/sensor adapters and PS4 receiver adapter. The receiver adapter speaks its confirmed UART or I2C protocol and emits normalized controller state.

## Data flow

`Workspace → validation → target-aware IR → Arduino C++ + diagnostics → compile → user-confirmed upload → board`

The PS4 path is:

`External PS4 controller → receiver module → UART or I2C → receiver adapter → normalized buttons/axes → controller blocks → generated control logic`

The receiver does not imply native Bluetooth support on the ESP32-S3. CodeLab targets the external receiver module specified by the project owner.

## Proposed boundaries

- UI calls application services; it should not own compiler subprocess or wire-protocol logic.
- Generator functions should be pure where practical: workspace + target profile in, generated files + diagnostics out.
- Build/deploy should accept generated files and a target profile, not Blockly objects.
- Receiver adapter should expose a stable API such as connection state, named buttons, normalized axes, and timestamps. Exact API waits on the module protocol.
- Board profiles validate pins and capabilities before code generation.
- Start with the web app. Before compile/upload, choose whether a native helper/desktop shell is needed for local Arduino toolchains and serial access; do not assume browser APIs cover every supported platform.

## Open decisions

- Whether to add desktop packaging after the web editor.
- Selected Arduino toolchain and how it is installed/updated.
- Exact ESP32-S3 board(s), flash/partition assumptions, and upload path.
- Exact PS4 receiver model, protocol, electrical requirements, and licensing.
- Workspace file extension/schema evolution and compatibility policy.
