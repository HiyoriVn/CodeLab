# Instructions for coding agents

## Source of truth

- Read this file and the relevant documents in `docs/` before changing architecture or project scope.
- Treat features as planned until they exist in this repository and have been run or otherwise verified.
- Keep claims about the NewmaniaCodeLab archive clearly attributed to that separate reference project.
- The user selected a browser-first web app for the initial platform. Use React, Vite, and Blockly in the Phase 1 scaffold; desktop packaging may be evaluated later.
- Keep the MVP on ESP32-S3 and Arduino C++. Do not add MicroPython generation or conversion to MVP scope unless the project owner changes this decision.
- The confirmed mainboard is STEAM Robotics Mainboard V2.0 with ESP32-S3-MINI-1-N8. Use `docs/hardware/HARDWARE.md` and `docs/hardware/PINOUT.md`, including their source and unknown-value labels. Do not change GPIO assignments.
- The external ESP32 is a PS4 bridge only; it must not control motors or servos. V2 mainboard UART1 uses TX GPIO6 and RX GPIO7, with crossed TX/RX and common ground. Signals are 3.3 V; do not connect the header's +5V_Core to the bridge before its power input is verified. The bridge chip and its UART pins remain unknown; enable Bluetooth Classic only after confirming chip support.
- Existing UART/I2C Blockly adapters are legacy source, not verified support for this board. The selected PS4 connection is UART1, not I2C. The selected bridge library is PS4Bluepad32 1.0.1 / Bluepad32 on a separate ESP32; the ZIP is used externally by the compile-only bridge candidate and is not vendored. UART CSV v1 remains the mainboard compatibility baseline.

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

## V1 fast track scope — 2026-11-05

- The user authorized multi-board web/generator/build integration and safe basic-I/O firmware/examples for Newmania Starter V1.0 as the test board. V2 remains the target board; preserve its accepted native BoardConfig/SafeStartup. This supersedes the old documentation-only boundary for this task only.
- Read `docs/boards/BOARD_PROFILES.md` and `docs/boards/V1_HARDWARE_TEST.md`. Use `src/boards/profiles.js` for web/build mappings; keep blocks generic. Do not silently remap pins in old workspaces. Missing optional project.boardId means Generic.
- V1 N8R2 has QSPI PSRAM: Core3.3.7, FlashSize=8M, PartitionScheme=default_8MB, PSRAM=enabled; V2 N8 remains PSRAM=disabled. Runtime memory/USB and power need hardware validation.
- Do not enable motor/servo or infer that DC3–15V board input is safe for 3–6V kit motors. No auto-upload, COM selection, commit/push, MotorDriver V2 or PS4Bridge work is authorized by this fast track.

## PS4 A2–A4 scope — 2026-11-05

- Issue19 authorizes the isolated Classic ESP32 bridge candidate and mapping/publisher software only. Do not modify V1/V2 profiles or accepted mainboard/A1 code; do not flash or start A5 automatically.
- Web Pairing is canceled: no Wi-Fi AP, HTTP server, or pairing UI. Keep PS4Bluepad321.0.1/Bluepad32, CSV v1 and debug/data UART separation. Library sources remain external; temporary extraction for compile is not vendoring into CodeLab.
- Final bridge MCU/board/pins/power remain unknown. Compile-only ESP32 Dev Module with Bluepad32 core4.1.0 is not hardware acceptance; UART/LED default unassigned/disabled. Real GPIOs require owner confirmation.

## Robotics blocks integration — 2026-11-05

- The user authorizes profile-aware Robotics blocks/generation, examples and software verification. Preserve native V1/V2 firmware, profile mappings and PS4 bridge. Do not flash/upload or start hardware/A5 work.
- Resolve motor/servo channels through the profile registry. Preserve unsupported channel values across import/profile switching and report diagnostics; never silently remap them. Motor motion and servo enable/write remain unsupported until driver semantics, power and safety gates are verified. Servo disable only releases the signal to INPUT/FLOATING; it does not control power or prove safe mechanical release.
- Generator statement chains and standalone expression terminators are regression-tested. Keep derived V1/PS4 golden sketches synchronized after shared generator fixes; this does not authorize changing their native drivers or protocol.
