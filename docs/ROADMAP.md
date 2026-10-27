# Development roadmap

Implementation status describes source state. A phase is complete only after its acceptance checks are run and recorded.

## Phase 0 — Product and hardware definition

**Status:** web-first and Arduino C++ MVP decisions are set. Exact board, operating-system matrix, receiver model, electrical details, and protocol compatibility remain open.

## Phase 1 — Web editor and workspace

**Status:** React/Vite + Blockly, Vietnamese toolbox, workspace JSON open/save, and browser-local autosave are implemented in feature branches; unverified.

## Phase 2 — Arduino C++ generation

**Status:** a supported subset of Blockly control, logic, math, text, variables, and robotics code generation is implemented in feature branches; unverified. Unsupported blocks produce warnings.

## Phase 3 — Robotics blocks

**Status:** GPIO, ADC, PWM, delay, and generic H-bridge blocks are implemented in draft PR #5; unverified. Pin diagnostics are chip-level, and no board-specific profile is included.

## Phase 4 — Compile and upload

**Status:** local Arduino CLI bridge, port selection, compile/upload UI, explicit upload confirmation, and temporary build retention are implemented in draft PR #6; unverified. No browser, CLI, compile, or hardware check has been run.

## Phase 5 — PS4 adapter

**Status:** a CodeLab UART/I2C frame contract, generated decoder, and Blockly access blocks are implemented in source on `feat/phase-5-ps4-adapter`; unverified. Direct support for the user's receiver remains unresolved until its model and protocol are known. A translating adapter may be required.

**Exit criteria**
- Confirm electrical levels, board wiring, exact receiver, and whether it can emit the CodeLab contract.
- Validate UART and I2C frames, button/axis mapping, stale-data disconnect behavior, and the safe-state robot example.
- Record hardware results for the exact board and receiver.

## Phase 6 — Stabilization and first release

Accessibility, examples, troubleshooting, supported-platform checks, compiler diagnostics, and reproducible packaging remain to be completed after user testing and hardware acceptance.

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
