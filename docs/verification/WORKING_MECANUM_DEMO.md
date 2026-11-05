# Working mecanum demo attempt — 2026-11-05

Scope: prepare one integrated Newmania S3 demo using existing PS4 bridge/controller/parser, investigate onboard drivers only where relevant. Initially clean workspace; current baseline HEAD `dcc22c4d732bd66a9e664d825896a59e76691e77`. No COM open, hardware tests, flash/upload, external DC, pairing/MAC reset, library installation or commit/push in this task.

**Delivery boundary: software/UART candidates compile; four-motor + real-servo movement NOT completed.** Reference RZ7899 truth table is resolved, but actual motor GPIO routing remains unresolved on the16MB/OPI board. Physical actuator backend remains mock/blocked, explicitly labeled in USB output. No external driver proposed or onboard-driver impossibility claimed.

## Source and wiring findings

- ZIP1.0.1 stock SerialMonitor sample examined directly: debug text only, no CSV data UART. Actual flashed sketch/path still unconfirmed; Arduino sketchbook only contained a Bluetooth capability probe. Do not equate these sources with the exact D1 image.
- User confirms current wiring was I2C: D1 GPIO21 to SCL, GPIO22 to SDA, and authorizes preparing rewire. New proposed UART: D1 TX21 -> S3 RX21, D1 RX22 <- S3 TX18, commonGND. S3 numbers are user reference pin table, not actual continuity proof; no wiring changed by agent. No power pins joined. No old I2C fallback added.
- User screenshots show RZ7899 motor35/36,37/38,39/40,41/42; servo12..15,5V bus; UART18/21; I2C8/9; schematic Version1.0 dated15/8/2025. These do not resolve N8R2 reference vs actual16MB/OPI memory discrepancy. Exact physical board module/trace mapping still needed.
- [Manufacturer-authored RZ7899 PDF p1](https://ksp-electronics.com/media/167845/201810310633.pdf) establishes FI/BI10 forward,01 reverse,00 coast,11 brake. Added testable plan only; no GPIO writer or unverified brake/reversal policy.

Full pin/motor/servo tables, interface notes, blocked commands and short bench procedure: [demo README](../../firmware/demos/newmania_ps4_mecanum/README.md).

## Verification

- `npm test`: **37/37 PASS, exit0**; existing real publisher/parser/controller tests retained, plus demo mode/commands, logical RZ7899 duty/stop/cap, servo mock, watchdog/reconnect, canonical parser-header equality and compile-negative tests rejecting35–37 even with wiring flag set.
- `npm run build`: **PASS, exit0**,62 modules; existing bundle-size/Blockly deprecation warnings.
- Default S3 demo: **PASS exit0**, program342998 B, globals24300 B, BIN343152 B; SHA256 `0F9C02AA8D5CA652B13769F8DCA5CA9AFE68DE554055A7D3A10C0065B8E77C1A`. UART disabled by default, no actuator GPIO.
- Existing bridge with proposed D1 TX21/RX22: **PASS exit0**, program719061 B, globals87108 B, BIN725632 B; SHA256 `64C8C86711DAF79C8FA8B6E2FCE6373DF65595AC92BE181F015E7522DE690CCF`. Unchanged library/pairing/MAC/bridge source. It is a compile target candidate, not measured D1 hardware acceptance.
- S3 UART-enabled candidate: **PASS exit0**, program351918 B, globals24300 B, BIN352064 B; SHA256 `89B6F19645400B500C1BC520997BE2C6107E615A24FD3C19222D8D81EA0F7162`. This build is for future reviewed rewire, not confirmation it has happened. No physical rewire/CSV observation claimed.

Raw logs ignored: `docs/verification/mecanum_working_demo_compile.log`, `mecanum_working_demo_uart_compile.log`, `mecanum_d1_bridge_compile.log`; host executable/log under firmware/tests/build-output. Board registry/profiles, accepted native firmware, bridge sources and existing parser/controller library unchanged. Parser-header generation helper extended to derive the same canonical header for this demo. Existing compile helpers accept optional sketch/log/pin candidate parameters; their default targets remain the same.

## Real blockers and next usable step

1. Rewire old I2C connection to reviewed UART header pair and separately approve firmware uploads; inspect actual CSV on USB status. Exact D1 running image still unconfirmed, but compiled existing A2–A4 publisher supplies known format without rewriting Bluetooth.
2. Actual four onboard RZ7899 FI/BI routes on this Octal PCB:35–37 cannot be used, no substitute mapping proven. Need schematic/continuity or motor code proven on this exact board. M3/M4 references do not establish a safe four-wheel backend.
3. Confirm selected servo signal, actual5V stability/current route and model/pulse/mechanical limits. Slide max2A is not measured supply readiness or per-servo current. No servo enable before confirmation.
4. Wheel role/polarity/roller orientation and motor supply/load limits need individual bench tests after GPIO/power gates. Logical cap15% is not an established safe motor voltage or measured speed.

No automatic upload, external-driver recommendation or further phase follows this task. All physical tests remain unperformed.

## Commit-ready summary

Implementation: one mainboard sketch with real gated UART parser/USB diagnostics, monitor default and explicit mock simulation; existing D1 publisher reused with proposed21/22 data pins. RZ7899 truth-table plan verified; no four-motor GPIO backend, real-servo output or claimed moving-robot acceptance. All37 host tests and web build PASS; default S3/UART-candidate S3/bridge compiles PASS exit0.

Files created/modified (17):

- `AGENTS.md`
- `README.md`
- `docs/PROGRESS.md`
- `docs/TESTING.md`
- `docs/robotics/PS4_MECANUM.md`
- `docs/verification/WORKING_MECANUM_DEMO.md`
- `firmware/demos/newmania_ps4_mecanum/DemoConfig.h`
- `firmware/demos/newmania_ps4_mecanum/DemoRuntime.h`
- `firmware/demos/newmania_ps4_mecanum/GeneratedPs4Parser.h`
- `firmware/demos/newmania_ps4_mecanum/README.md`
- `firmware/demos/newmania_ps4_mecanum/Rz7899Plan.h`
- `firmware/demos/newmania_ps4_mecanum/newmania_ps4_mecanum.ino`
- `tests/working-demo-native.cpp`
- `tests/working-demo.test.mjs`
- `tools/robot-parser-header.mjs`
- `tools/verify-mecanum.ps1`
- `tools/verify-ps4-bridge.ps1`

Excluded: firmware build-output (including uart_candidate/D1 images), BIN/ELF/map/executables, host logs, raw mecanum_*.log, node_modules/dist. External PS4 library remains outside repo. No existing profile, canonical parser/controller library or native/bridge firmware source changed; no staged files or commit/push.

```powershell
git add -- AGENTS.md README.md docs/PROGRESS.md docs/TESTING.md docs/robotics/PS4_MECANUM.md docs/verification/WORKING_MECANUM_DEMO.md firmware/demos/newmania_ps4_mecanum/DemoConfig.h firmware/demos/newmania_ps4_mecanum/DemoRuntime.h firmware/demos/newmania_ps4_mecanum/GeneratedPs4Parser.h firmware/demos/newmania_ps4_mecanum/README.md firmware/demos/newmania_ps4_mecanum/Rz7899Plan.h firmware/demos/newmania_ps4_mecanum/newmania_ps4_mecanum.ino tests/working-demo-native.cpp tests/working-demo.test.mjs tools/robot-parser-header.mjs tools/verify-mecanum.ps1 tools/verify-ps4-bridge.ps1
git diff --cached --stat
git diff --cached --check
git commit -m "feat(robotics): add gated UART demo and RZ7899 drive plan"
git push origin codex/integrate-bach-ui
```
