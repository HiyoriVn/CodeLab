# Development roadmap

The phases below describe the current state of the main branch. Source presence does not mean runtime or hardware acceptance; those results are recorded separately in [the verification plan](TESTING.md).

## Phase 0 — Product and hardware definition

**Status:** partially defined. Web-first development, ESP32-S3, and Arduino C++ MVP are decided. Exact board, operating-system matrix, receiver model, electrical details, and protocol compatibility remain open.

**Still needed:** record the exact board and pinout, supported host platforms, receiver documentation, voltage/wiring, and hardware acceptance setup.

## Phase 1 — Web editor and workspace

**Status:** implemented in `main`: React/Vite + Blockly editor, Vietnamese toolbox, versioned workspace JSON open/save, browser-local autosave, and examples. Runtime behavior is unverified.

## Phase 2 — Arduino C++ generation

**Status:** implemented in `main` for a subset of Blockly control, logic, math, text, variables, and robotics blocks. Unsupported blocks and diagnostics produce warnings. Generated code has not been compiled.

## Phase 3 — Robotics blocks

**Status:** implemented in `main`: GPIO, ADC, PWM, delay, and generic H-bridge blocks with chip-level pin diagnostics. No board-specific profile or hardware validation is included.

## Phase 4 — Compile and upload

**Status:** implemented in `main`: local Arduino CLI bridge, port selection, compile/upload UI, explicit upload confirmation, and temporary build retention. Browser, CLI, compile, serial, and board behavior remain unverified.

## Phase 5 — PS4 adapter

**Status:** implemented in `main` as a CodeLab UART/I2C frame contract, generated decoder, and Blockly access blocks. This is not vendor-specific receiver support.

**Still needed:** identify the receiver and confirm whether it emits this contract or needs a translator; verify electrical levels/wiring; check valid, malformed, stale, and disconnected inputs; validate the safe-state example on the actual board.

## Phase 6 — Stabilization and first release

**Status:** starter recipes and troubleshooting guidance are in `main`. Runtime examples, accessibility, supported-platform checks, reliability, compiler diagnostics, and release packaging have not been verified.

**Exit criteria:** documented examples pass on supported hardware, toolchain/platform versions are recorded, accessibility and reliability checks pass, and a reproducible release build plus tested hardware matrix are published.

## Later ideas

MicroPython generation, cloud accounts/sharing, and non-ESP32-S3 board families remain outside MVP.

## Phase 1 UI refresh and local projects

**Status:** Full-screen CodeLab studio layout, right-side Code / serial monitor / device panels, browser-local multi-project list, and project import/export are implemented in source; unverified. The demo's purple and gold palette is the initial visual reference. Custom color and language preferences remain future work. The local project list is stored in the current browser profile; users should export project files for backup or transfer.

**Acceptance checks**
- Verify right-side panels can be switched and collapsed/reopened without losing workspace state.
- Create multiple projects, switch between them, reload the app, and confirm each workspace and name persists.
- Export a project, import it, and confirm the workspace matches; invalid files must leave the current project intact.
- Exercise serial monitor connect/read/write/disconnect in a supported browser and record the browser and board.
- Confirm the editor remains usable at narrow/mobile widths.
