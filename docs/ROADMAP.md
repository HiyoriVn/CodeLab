# Development roadmap

This roadmap distinguishes work present in a branch from work that has been verified. A phase is complete when its exit criteria are met and documented in the repository.

## Phase 0 — Product and hardware definition

**Status:** web-first platform and MVP language are decided; hardware/toolchain definition remains open.

**Goal:** remove foundational ambiguity before writing board-specific code.

**Work**
- Confirm supported ESP32-S3 board(s), host operating systems, and hardware validation setup.
- Select the external PS4 receiver module; obtain its official protocol/library documentation.
- Confirm UART or I2C transport, logic voltage, wiring, address/baud rate, packet format, and reconnect behavior.
- Define MVP robotics peripherals and safe pin rules.
- Decide whether compile/upload uses Arduino CLI, PlatformIO, or another supported toolchain.

**Exit criteria**
- Hardware matrix and pin constraints are recorded.
- PS4 module/protocol and a minimal input-to-block use case are agreed.
- MVP acceptance scenarios and supported host platforms are listed.

## Phase 1 — Web application and workspace

**Status:** initial React/Vite + Blockly shell, localized toolbox, example workspace, browser-local autosave, and JSON open/save are present on `feat/phase-1-editor-shell`; not yet run or verified.

**Goal:** establish the web app shell and workspace persistence.

**Work**
- Create application shell and accessible editor layout.
- Integrate a visual block workspace and versioned workspace save/open format.
- Add examples and reset/undo/redo behavior.

**Exit criteria**
- A user can create, save, reopen, and edit a sample workspace without losing blocks.
- Invalid or unsupported workspace files produce clear errors.
- CI and local setup instructions are reproducible.

## Phase 2 — Arduino C++ generation

**Goal:** deliver a small, deterministic language pipeline.

**Work**
- Define block schema and supported-block registry.
- Generate Arduino C++ with stable includes, setup/loop structure, and helper functions.
- Add code preview, generator diagnostics for unsupported blocks, and golden output fixtures.
- Keep board-specific APIs behind target configuration.

**Exit criteria**
- Every MVP block has generator fixtures and documented semantics.
- Repeated generation from the same workspace produces identical output.
- Unsupported blocks are identified; no silent omission.
- Generated examples compile with the selected toolchain for the supported ESP32-S3 target.

## Phase 3 — Board and robotics blocks

**Goal:** express safe beginner robotics programs.

**Work**
- Add board profile and pin validation.
- Implement foundational timing, digital/analog I/O, variables, conditionals, loops, and selected motor/servo/sensor blocks.
- Document wiring and provide runnable examples.

**Exit criteria**
- Block inputs enforce types and constraints.
- Pin conflicts and invalid values surface before upload.
- Each supported peripheral example is checked against its documented wiring and hardware.

## Phase 4 — Compile and upload

**Goal:** turn a workspace into a safely deployable board program.

**Work**
- Add compile and upload pipeline with explicit target selection and progress/error reporting.
- Manage serial/USB permissions, port selection, disconnects, and recovery.
- Do not upload until the user explicitly starts the action.

**Exit criteria**
- Compile failures map to useful user-facing diagnostics.
- Successful upload and board restart are demonstrated on the supported board matrix.
- Cancel, disconnect, and upload-failure paths leave the app and board in a recoverable state.

## Phase 5 — PS4 receiver integration

**Goal:** expose controller input from the selected external receiver to block programs.

**Work**
- Implement the verified UART or I2C protocol behind a receiver adapter.
- Normalize buttons, axes, connection state, and update cadence into a transport-independent controller model.
- Add controller blocks and a live input monitor.

**Exit criteria**
- Wiring, voltage, protocol, supported receiver firmware, and reconnect behavior are documented.
- Button and axis readings match the receiver's documented ranges.
- A robot example uses controller input with a safe neutral/disconnect behavior.
- Hardware test results include the exact module and board used.

## Phase 6 — Stabilization and first release

**Goal:** make the MVP understandable, recoverable, and distributable.

**Work**
- Accessibility, localization baseline, examples, onboarding, and troubleshooting.
- Performance and reliability checks for larger workspaces and repeated connect/upload cycles.
- Package releases and document known limitations.

**Exit criteria**
- All release-gate checks in `docs/TESTING.md` pass for supported platforms.
- Known limitations and tested hardware/software versions are published.
- A tagged build can be reproduced from documented instructions.

## Later ideas (not MVP commitments)

MicroPython generation, cloud accounts/sharing, board families beyond the validated ESP32-S3 target, and custom themes/localization can be evaluated after MVP feedback. The reference archive's Python/MicroPython support does not move it into MVP scope.
