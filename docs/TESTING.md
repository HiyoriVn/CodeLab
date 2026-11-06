# Testing and verification strategy

## Issue22 Scratch-first editor — 2026-11-06

`npm test`: **47/47 PASS**, exit0 (8 focused beginner checks plus existing regressions). `npm run build`: **PASS**, exit0. Initial restricted run had localhost EACCES in five HTTP tests; rerun with local execution permission passed, with no source workaround or hardware access. Existing Blockly deprecation and Vite large-chunk warnings remain. Browser smoke verified default Beginner, all three lessons, drag/drop, Advanced toolbox, mode/profile switching, unsupported LED warning and reload preserving blocks/profile/mode. [Usage, fixtures, compile-only command and evidence](SCRATCH_FIRST.md); final compiler results recorded in PROGRESS.

## Issue20 I2C sequence demo — 2026-11-05

`npm test`39/39 PASS; web build PASS, exit0. New native frame tests cover13-byte LE/flags, unchanged polling and fresh-identical reports, sequence127→0, invalid/partial/torn frames, timeout/bus recovery quarantine,250/251ms/clock wrap, actual A2 mapping201 axis values and mecanum/servo mock/latched FAULT/re-arm. Header copies must match canonical A2 byte-for-byte. D1 core4.1.0 and S3 core3.3.7 compiles PASS/exit0, OPI preserved. [Short test/upload guide](../firmware/demos/newmania_ps4_i2c/README.md). No device access, upload, I2C radio/physical observations or load tests in this task.

## Integrated PS4 robot demo attempt — 2026-11-05

`npm test`37/37 PASS and `npm run build` PASS/exit0. New demo runtime tests cover monitor preventing arm, explicit SIM, blocked hardware commands, low capped RZ7899 plans, Share/Options/PS, servo mock, timeout/reconnect, canonical header reuse; negative compiler cases reject35–37 even with UART confirmation flag. Default S3, proposed-rewire UART S3 and D1 bridge all compile PASS/exit0; all nonempty binaries. [Commands/results](verification/WORKING_MECANUM_DEMO.md), [wiring and deferred load tests](../firmware/demos/newmania_ps4_mecanum/README.md). No hardware test/upload in this task; actuator backend blocked by unresolved actual GPIO/power.

## PS4 mecanum simulation — 2026-11-05

`npm test`34/34 PASS, `npm run build` PASS/exit0. New native C++ host scenarios test4913 mixer vectors, mapping/permutation/inversion/saturation, arming/neutral/deadzone/acceleration, disconnect/reconnect/held buttons,250/251ms/wrap/stall, servo bounds/power/backend failures; actual existing CSV publisher and parser are included. Standalone parser header must match generator byte-for-byte; regeneration: `node tools/robot-parser-header.mjs`. Arduino INPUT macro collision guarded in native compile. `pwsh -NoProfile -File tools/verify-mecanum.ps1` compile-only PASS/exit0 with unchanged experimental16MB/OPI/Core3.3.7; no UART/GPIO or actuator initialization in sketch. [Full results/API/hardware gates](robotics/PS4_MECANUM.md). Pure logic/mock acceptance only; no hardware actuation tests.

## Experimental Newmania OPI profile — 2026-11-05

`npm test`32/32 PASS, `npm run build` PASS, exit0. Five added checks cover LED-only allowlist, absence of board/memory GPIO startup, serialization/goldens, invalid old pins/channels retained with diagnostics, HTTP compile target and stale-profile upload rejection. Existing profile/PS4/native checks retained. Rebuild experimental examples with `node tools/v1-opi-examples.mjs`; this never uploads. Only actual CLI/Blink result and individually approved hardware results recorded in [integration report](verification/V1_HARDWARE_INTEGRATION.md).

## Robotics blocks — 2026-11-05

Run `npm test`, `npm run build`, `npm run examples:robotics` (deterministic fixture regeneration), then `node tools/verify-robotics-build.mjs` with the existing CLI/data/downloads environment configured as in [development setup](DEVELOPMENT.md). The last command performs compile-only HTTP/CLI verification, never port selection/upload. Examples include supported basic I/O/Serial, servo signal disable and intentionally unsupported motor/servo workspaces. Keep unsupported workspaces as JSON only, with warnings that block compile.

27/27 host tests and production build PASS. Tests cover next-block/nested chains, floating C++ expression terminators, serialization, legacy profiles, pin/mode conflicts, channel retention, no motor/servo pulses, parser/publisher and stale upload guards. Browser smoke verified V2 M6 -> V1 preserves the block and reports invalid channel. Hardware remains untested. Final compiler results and limitations: [Robotics report](verification/ROBOTICS_BLOCKS_INTEGRATION.md).

## Newmania V1 fast track — 2026-11-05

`npm test`: 15/15 host/generator/native fake-GPIO/HTTP tests PASS; `npm run build` PASS; six V1 examples compiled through the real CLI bridge with Core3.3.7/QSPI PSRAM and nonempty binaries. Chrome profile/persistence/device-dialog smoke checks passed. No actual upload, Serial I/O, GPIO waveform or hardware test. Detailed evidence/limits: [fast-track report](verification/NEWMANIA_V1_FAST_TRACK.md); future board checks: [V1 checklist](boards/V1_HARDWARE_TEST.md). SOFTWARE_ACCEPTED applies to this software scope; HARDWARE_UNTESTED remains.

## Hardware/firmware Phase 01 audit - 2026-11-04

Audited local branch `codex/integrate-bach-ui` at `f3a839825ca2e83fcb82337cbfe4f8dd2afc3efc`; Windows, Node 26.12.1, npm 11.20.0. Detailed commands/outcomes and limits are in [PHASE01_AUDIT.md, section 7](PHASE01_AUDIT.md#7-verification-results); final documentation checks are in [PROGRESS.md](PROGRESS.md).

- `npm run build`: passed, Vite 7.3.7, 59 modules, 7.53 s; JS chunk 1,032.85 kB, warning >500 kB.
- `npm ls --depth=0`: React/React DOM 19.3.1, Blockly 12.5.1, Vite 7.3.7, React plugin 5.2.0. No dependencies installed or changed.
- `node --check tools/arduino-bridge.mjs`: passed syntax only.
- Headless Blockly/generator audit: empty/motor/GPIO samples generated repeatable text; UART RX7/TX6, UART RX16/TX17 and I2C samples all returned `Cannot set properties of undefined (setting 'ps4_stdio')`. **PS4 generation failed**, despite process exit 0. No C++ compilation was performed.
- Evaluating the existing PS4 helper template confirmed two NUL characters and raw LF/CR inside character literals. This is an additional generation defect, not a successful parser test.
- Read both supplied PDFs (4 pages total), extracted text and visually checked all pages; inspected the external PS4Bluepad32 ZIP without installing/running it.
- `arduino-cli` and `pio` were not found on PATH. No browser rerun, compile/upload, serial I/O, Bluetooth pairing or hardware test was performed. Existing UI records below remain historical evidence only.

The numbered manual phases below retain the historical **web roadmap**. Use [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the new firmware Phase 02-07 criteria. No automated test suite was added during this documentation-only audit.

The audited checkout contains the web editor, generator, robotics blocks, local compile/upload bridge and PS4 adapter source. No hardware acceptance is recorded and no automated test suite is present. The sections below are acceptance checklists; dated records distinguish checks actually performed from outstanding work.

## UI integration checks — 2026-11-04

Branch: `codex/integrate-bach-ui`, based on main `608e2e6`, porting Bách's `7ebec68` UI with project switching restored. Windows, Node 26.12.1, npm 11.20.0, Vite 7.3.7.

- `npm install --no-package-lock`: succeeded; no new declared dependencies; audit reported zero vulnerabilities at install time.
- `npm run build`: passed. Vite reports a JavaScript chunk larger than 500 kB (about 1.03 MB minified); bundle optimization remains follow-up work.
- Node/Blockly isolated-workspace assertion: a supported block loaded and an unknown block type threw as expected. This checks the import-validation mechanism, not the full browser file-picker flow.
- `git diff --check`: passed before committing.
- Chrome at `http://127.0.0.1:5174`: editor/toolbox rendered; created a second empty project, switched to the first, reloaded, and verified both projects and the active selection in the File menu.
- Code preview rendered Arduino setup/loop; dark-mode switch and bottom serial panel worked. Device dialog showed bridge-unavailable feedback, with compile/upload disabled.
- Browser console reported the existing Blockly `getAllVariables` deprecation warning. No renderer fallback warning was observed in the inspected logs.
- Browser import check was blocked by the extension's disabled local-file access; import/export round-trip, nonempty workspace persistence, block drag/connect behavior, and responsive/accessibility acceptance remain outstanding.
- No Arduino compile, upload, serial I/O, receiver, or hardware acceptance was attempted. These smoke checks do not establish MVP release readiness.

## Phase 1 manual acceptance

When the scaffold is available locally, verify and record:
- The app starts in a supported desktop browser and the Blockly toolbox renders.
- Blocks can be created, connected, moved, deleted, and undone/redone.
- Once an example workspace is added, it loads and can be edited; none is shipped as a standalone example in the audited checkout.
- Changes survive a page refresh in the same browser profile.
- Downloaded workspace files reopen with their blocks intact.
- Invalid JSON, unknown format, and unsupported schema versions show a clear error without replacing the current workspace.
- The editor remains usable at a narrow/mobile viewport.

## Phase 2 manual acceptance

When the app can be run locally, verify and record:
- The sample workspace produces the expected `setup()` and `loop()` Arduino structure.
- Each supported block generates syntactically plausible C++ with nested statements preserved.
- Supported control, math, text, and variable blocks produce the documented output.
- Unsupported blocks and mixed/unknown variable types are listed and visibly marked as placeholders.
- Repeated generation from an unchanged workspace produces identical output.
- Copying the preview works where the browser grants clipboard access.

## Phase 3 manual acceptance

When the app can be run locally with an ESP32-S3 target, verify and record:
- Generated GPIO setup statements appear once per pin.
- Pin role conflicts, missing pin values, reserved/unavailable pins, and non-ADC pins produce visible warnings.
- PWM and H-bridge output use the documented 5 kHz, 8-bit LEDC configuration and safe speed bounds.
- The H-bridge example is tested with the chosen motor driver and a separate motor supply; no motor is connected directly to a GPIO.

## Verification layers

### Workspace and block model
- Serialize and restore representative workspaces.
- Validate type checks, required inputs, pin constraints, and workspace schema migration.
- Verify unsupported block types are reported rather than dropped.

### Generator
- Golden fixtures for each supported block and representative combinations.
- Determinism checks for identical workspace and target inputs.
- Compile generated examples with the pinned Arduino toolchain and ESP32-S3 target.
- Confirm diagnostics identify the relevant block or generated source location.

### Device workflow
- Unit/integration coverage for port selection, cancellation, disconnect, timeout, and failed upload.
- Confirm upload requires an explicit user action and target selection.
- Hardware smoke test on each supported board and host OS.

### PS4 receiver
- Test protocol parsing with captured/synthetic valid, partial, malformed, and out-of-range frames.
- Verify connection loss and neutral controller state behavior.
- Hardware test against the exact module, wiring, voltage, interface, and firmware documented for the release.

### User experience
- Keyboard navigation and basic accessibility checks.
- Manual beginner scenarios using the published examples.
- Larger-workspace responsiveness and repeated compile/upload cycles before release.

## Hardware test record

For every hardware-dependent result, record:
- Date and CodeLab commit.
- Board model and revision.
- Receiver/peripheral model and firmware, when applicable.
- Wiring, voltage, transport settings, and relevant pin mapping.
- Host OS, toolchain version, and result.
- Any limitation or reproducible failure.

## Release gate

A first release requires generator fixtures, successful compilation for the supported ESP32-S3 target, successful upload smoke tests for the supported board matrix, validated PS4 integration if included in the release scope, and documented known limitations. Do not label untested hardware combinations as supported.


## Phase 4 manual acceptance

The compile/upload UI and loopback bridge are implemented in source but unverified. When available, verify:
- Missing Arduino CLI, missing ESP32 core, compile errors, and timeouts are shown clearly.
- A generated sketch compiles for the selected FQBN; compile is blocked while generator warnings remain.
- Only CLI-detected ports are offered and disconnects are handled.
- Upload is impossible before a successful build, requires the separate confirmation prompt, and reports CLI failure details.
- Temporary build directories expire; the bridge is reachable only on loopback.
- The built application served by the bridge and the Vite development proxy both reach the API.

Do not claim Phase 4 accepted until compile, upload, and disconnect scenarios are recorded for an actual supported board.


## Phase 5 adapter acceptance

The CodeLab packet decoder and blocks are implemented in source but unverified. Before treating them as receiver support, verify:
- UART lines parse only when all six CSV fields are valid; malformed/partial/overlong lines do not create a connected state.
- I2C frames use exactly 13 bytes and the documented little-endian field mapping.
- Axis normalization, button bit mapping, and stale-frame neutral state match the contract.
- Compile a workspace using each transport and its controller blocks.
- Test with the actual receiver or translating adapter and record board, voltage, wiring, firmware, and captured frames.

Until hardware identity and results are recorded, describe Phase 5 as adapter-contract support rather than compatibility with a particular PS4 module.


## Phase 6 manual acceptance

- Add the missing `EXAMPLES.md`, then follow each recipe on the documented board and record the observed result.
- Check keyboard navigation, labels, focus visibility, and readable warnings in a desktop browser.
- Repeat compile/upload and disconnect/reconnect scenarios; record supported OS, browser, board, and toolchain versions.
- Confirm the production bundle can be reproduced from the documented setup.

Do not mark the MVP release-ready until the hardware matrix and release gate above are complete.
