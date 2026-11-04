# Development roadmap

The numbered phases below are the **historical web roadmap**. They are separate from the new hardware/firmware Phase 01-07 in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Current audited status is in [PROGRESS.md](PROGRESS.md) and [PHASE01_AUDIT.md](PHASE01_AUDIT.md). Source presence does not mean runtime or hardware acceptance; results are recorded in [the verification plan](TESTING.md).

## Phase 0 — Product and hardware definition

**Status:** partially defined. Web-first and Arduino C++ MVP are decided. The 2026-11-04 task confirms STEAM Robotics V2.0 / ESP32-S3-MINI-1-N8 and UART1 TX6/RX7 for an external PS4-only ESP32 bridge. Board pinout is documented from two PDFs; bridge chip/power/pins, toolchains, OS matrix and protocol compatibility remain open.

**Still needed:** physical board confirmation, supported host platforms, bridge hardware identity/power, pinned firmware toolchains, final UART protocol and hardware acceptance setup.

## Phase 1 — Web editor and workspace

**Status:** source contains React/Vite + Blockly editor, Vietnamese toolbox, versioned workspace JSON open/save and browser-local autosave/projects. Build and limited historical UI checks are recorded; full acceptance is open. No standalone examples directory or `docs/EXAMPLES.md` exists in the audited checkout.

## Phase 2 — Arduino C++ generation

**Status:** implemented in `main` for a subset of Blockly control, logic, math, text, variables, and robotics blocks. Unsupported blocks and diagnostics produce warnings. Generated code has not been compiled.

## Phase 3 — Robotics blocks

**Status:** implemented in `main`: GPIO, ADC, PWM, delay, and generic H-bridge blocks with chip-level pin diagnostics. No board-specific profile or hardware validation is included.

## Phase 4 — Compile and upload

**Status:** implemented in `main`: local Arduino CLI bridge, port selection, compile/upload UI, explicit upload confirmation, and temporary build retention. Browser, CLI, compile, serial, and board behavior remain unverified.

## Phase 5 — PS4 adapter

**Status:** source contains a CodeLab UART/I2C contract, helper and Blockly blocks. Audit reproduced a PS4 generation failure and escaping defects. This is not functioning or verified vendor-specific receiver support; see the current audit before using it.

**Still needed:** identify the receiver and confirm whether it emits this contract or needs a translator; verify electrical levels/wiring; check valid, malformed, stale, and disconnected inputs; validate the safe-state example on the actual board.

## Phase 6 — Stabilization and first release

**Status:** setup/testing guidance exists, but the previously referenced `EXAMPLES.md` and `TROUBLESHOOTING.md` are absent in this checkout. Runtime examples, accessibility, supported-platform checks, reliability, compiler diagnostics and release packaging have not been verified.

**Exit criteria:** documented examples pass on supported hardware, toolchain/platform versions are recorded, accessibility and reliability checks pass, and a reproducible release build plus tested hardware matrix are published.

## Later ideas

MicroPython generation, cloud accounts/sharing, and non-ESP32-S3 board families remain outside MVP.

## Phase 1 UI refresh and local projects

**Integration branch update (2026-11-04):** `codex/integrate-bach-ui` ports Bách's UI onto main history, preserves local project switching, and adds light/dark and menu-color preferences. Code is a sidebar, serial is a bottom panel, and device controls use a dialog. Build and limited Chrome smoke checks passed; see [TESTING.md](TESTING.md). Language translation, nonempty workspace round-trip, responsive/accessibility acceptance, and hardware checks remain outstanding. The status below describes the original main baseline.

**Current integration status:** Full-screen studio, right code sidebar, bottom serial panel, device dialog, local projects/import-export, light/dark and menu colors exist in source. Limited checks are recorded above; language translation and full acceptance remain open. The local project list is stored in the current browser profile; users should export files for backup or transfer.

**Acceptance checks**
- Verify right-side panels can be switched and collapsed/reopened without losing workspace state.
- Create multiple projects, switch between them, reload the app, and confirm each workspace and name persists.
- Export a project, import it, and confirm the workspace matches; invalid files must leave the current project intact.
- Exercise serial monitor connect/read/write/disconnect in a supported browser and record the browser and board.
- Confirm the editor remains usable at narrow/mobile widths.
