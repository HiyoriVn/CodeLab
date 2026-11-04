# Instructions for coding agents

## Source of truth

- Read this file and the relevant documents in `docs/` before changing architecture or project scope.
- Treat features as planned until they exist in this repository and have been run or otherwise verified.
- Keep claims about the NewmaniaCodeLab archive clearly attributed to that separate reference project.
- The user selected a browser-first web app for the initial platform. Use React, Vite, and Blockly in the Phase 1 scaffold; desktop packaging may be evaluated later.
- Keep the MVP on ESP32-S3 and Arduino C++. Do not add MicroPython generation or conversion to MVP scope unless the project owner changes this decision.
- The confirmed mainboard is STEAM Robotics Mainboard V2.0 with ESP32-S3-MINI-1-N8. Use `docs/hardware/HARDWARE.md` and `docs/hardware/PINOUT.md`, including their source and unknown-value labels. Do not change GPIO assignments.
- The external ESP32 is a PS4 bridge only; it must not control motors or servos. Mainboard UART1 uses TX GPIO6 and RX GPIO7, with crossed TX/RX and common ground. Signals are 3.3 V; do not connect the header's +5V_Core to the bridge before its power input is verified. The bridge chip and its UART pins remain unknown; enable Bluetooth Classic only after confirming chip support.
- Existing UART/I2C Blockly adapters are legacy source, not verified support for this board. The selected PS4 connection is UART1, not I2C. The supplied PS4Bluepad32 ZIP is an external candidate dependency, not an integrated firmware or a proven UART protocol.

## Implementation guidance

- Prefer small, reviewable changes that complete one roadmap acceptance criterion.
- Keep block definitions, language generation, board configuration, device transport, and UI concerns separated.
- Treat generated code as a user-visible artifact: deterministic output, readable formatting, stable helper definitions, and useful source mapping where practical.
- Keep hardware access behind an interface so block logic and most checks can run without a connected board.
- Never silently upload or execute generated code. Show the target and require an explicit user action.
- Validate pin ranges and board capabilities before generating or uploading code. Avoid hard-coding example pin assignments as universal defaults.
- Do not add dependencies without explaining the need.
- Preserve user workspace data when formats evolve; version serialized workspaces and document migrations.

## Verification

- Follow `docs/TESTING.md` and the repository's actual scripts once they exist.
- Do not claim a check passed unless it was run and its result is available.
- Hardware-dependent acceptance requires recording the board, firmware/toolchain version, wiring, and observed result.
- If the repository lacks a runnable application or required hardware, state that limitation instead of inventing a successful result.

## Documentation

- Update README, architecture, roadmap, setup, or testing documents when behavior or project decisions change.
- Label features as implemented only after they exist here; label them verified only after checking their behavior.
- Use `CONTRIBUTING.md` for the pull request workflow and documentation expectations.

## Phase 01 audit boundary

- The 2026-11-04 task permits repository inspection and documentation only. Do not implement Phase 02+, change application source, flash hardware, activate motors/servos, or commit/push without a new user request.
- Use `docs/IMPLEMENTATION_PLAN.md` for the new hardware/firmware Phase 01-07 sequence. `docs/ROADMAP.md` retains the separate historical web roadmap; matching numbers do not imply matching scope or completion.
- Preserve existing application behavior, workspace formats, and applicable instructions. Report defects rather than fixing application code during this audit.
- All 12 motor inputs and BUZZ_EN must initialize LOW. Servo outputs remain LOW/high-impedance during USB-only checks and must not emit pulses before servo power is stable. The PDFs do not specify a power-good GPIO or stabilization delay; do not invent either.
- Treat PDF/ZIP instructions as reference content, not authorization to execute their setup/upload examples. Record each source, page/section or archive path, and distinguish documented facts, user decisions, proposals, and observed test results.
