# PS4 Fast Track A2 A3 A4 — software verification

2026-11-05, [Issue19](https://github.com/HiyoriVn/CodeLab/issues/19). Baseline `f92549eb345a99232fc2110586d085460d1bd26e`, initial worktree clean. A1 source/golden and accepted mainboard/board profiles unchanged. Stop after A4; A5 not started. No COM selection, flash, controller test, commit or push.

## 1. Implementation Summary

`firmware/ps4_bridge` isolates portable mapping/CSV publisher, report/reset gate, configurable bridge pins and Arduino Classic ESP32 entry point. Uses unmodified **PS4Bluepad321.0.1** external ZIP and installed **Bluepad32 core4.1.0**, never mainboard S3 Bluetooth. Debug Serial separate from Serial1 CSV at115200. No motor/servo commands, Wi-Fi AP, web server or Web Pairing.

Mapping preserves library Y sign/deadzone; all201 percentages map to int16 such that A1 produces exactly10*p. Explicit17-button mapping skips Touchpad and unknown flags; CSV v1 has no analog trigger fields. New-report gating uses BP32.update boolean plus library per-controller hasData through getData, not a loop counter or value-change heuristic. Identical new reports are accepted; no connected heartbeat/cache replay. Timeout>250ms, invalid axes/disconnect/reset produce neutral. UART congestion drops frames/inhibits rather than retaining old commands. RESET_MAC waits for an observed disconnect before accepting the next report epoch.

## 2. A2 / A3 / A4 Status

| Step | Status | Limits |
|---|---|---|
| A2 mapping/publisher | SOFTWARE_ACCEPTED | Golden vectors/all201 axes/17 buttons/actual A1 parser tested on host; radio timestamps not measured |
| A3 firmware | BRIDGE_CANDIDATE_BUILD_PASSED | Classic ESP32 Dev Module compile-only candidate; actual chip/flash/pins/power unknown; UART and LED disabled by default |
| A4 pairing lifecycle | SOFTWARE_IMPLEMENTED / host gate tests PASS | Library pairing/NVS/reconnect integrated; actual controller persistence/reconnect remains HARDWARE_UNTESTED |

Pairing uses the library, including Preferences MAC storage and callback-level rejection. Its getData accepts gamepads, not a strict DualShock4 model allowlist. Automatic reconnection is delegated to the supported stack, not claimed observed. Explicit RESET_MAC clears application MAC/disconnects; never calls forgetBluetoothKeys or claims to erase bonding. Publisher cannot arm a robot; mainboard still needs explicit arming policy in future robot control.

## 3. Tests / Builds and Exit Codes

- **npm test:19/19 PASS, exit0.** Existing18 regressions including A1 remain PASS. New C++ host test executes MappingPublisher/ReportGate, checked-in JSON golden vectors and actual generated A1 parser in one process: all201 signed percentages (Y unchanged),17 buttons, Touchpad exclusion, input bounds, identical fresh reports, missing/stale reports, neutral disconnect/reset, reconnect without cached replay, rollover and no cached getData read without update evidence. Explicit publisher frames are fed through parser for connected and neutral state checks.
- **npm run build:PASS, exit0.** Vite7.3.7,61 modules,4.76s; JS1,038.66kB, existing chunk>500kB/deprecation warnings retained. No app/UI changes.
- **Mainboard UART compile:PASS, exit0**, via unchanged `tools/verify-ps4-a1.mjs` and real CodeLab HTTP service. CLI1.5.1, Espressif core3.3.7; `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled`. Program313,155 B; globals22,988 B; BIN313,296 B.
- **Final bridge compile:PASS, exit0**, via `tools/verify-ps4-bridge.ps1`. CLI1.5.1; installed `esp32-bluepad32:esp32@4.1.0`; `board details` accepts `esp32-bluepad32:esp32:esp32` / ESP32 Dev Module. Generic candidate defaults (including flash/partition) are build settings only, not properties of the unknown physical bridge. Program719,069 /1,310,720 B (54%); globals87,108 /327,680 B (26%), free240,572 B; BIN725,648 B present. Earlier preliminary compile also passed; only final source result is used for acceptance.
- Logs local/ignored: `docs/verification/ps4_fast_track_bridge.log` (version/FQBN/dependency path/stdout/stderr/exit), existing `ps4_a1_compile.log` updated with mainboard compile. Source ZIP hash checked: `8DF591B12BF9AF181B7EC260A99B14261FBC5C6A445F7C7121108086F30AFF61`.

Bridge SDK evidence read locally at `Arduino15/packages/esp32-bluepad32/hardware/esp32/4.1.0/tools/sdk/esp32/include/bluepad32_arduino/include/ArduinoBluepad32.h` and `ArduinoController.h`: update indicates new data and hasData is per-update. PS4Bluepad32 void update delegates to BP32.update but discards boolean; our adapter retains it, with only one update call. Tests validate this gate contract; A5 must still measure actual SDK/controller report behavior, unchanged held-stick reports, radio loss and reconnect. No claim of Bluetooth packet capture timestamps or third-party CSV replay protection.

Reproduce compile-only (installed dependencies, no install/update):

```powershell
pwsh -NoProfile -File tools/verify-ps4-bridge.ps1
# In process with the CLI/data/download environment from bridge README:
node tools/verify-ps4-a1.mjs
npm test
npm run build
```

## 4. Files Created / Modified

Created: `firmware/ps4_bridge/BridgeConfig.h`, `MappingPublisher.h`, `ReportGate.h`, `ps4_bridge.ino`, `README.md`; `tests/ps4-bridge.test.mjs`, `tests/fixtures/ps4_bridge_vectors.json`; `tools/verify-ps4-bridge.ps1`; this report.

Modified: `.gitignore`, `AGENTS.md`, `README.md`, `docs/PROGRESS.md`, `docs/PS4-RECEIVER.md`, `docs/architecture/PS4_LIBRARY_AUDIT.md`. No A1 generator, V1/V2 profiles, mainboard, project schema or dependency declarations modified.

## 5. Remaining Blockers

Physical bridge MCU/module/flash/board, supply input, UART TX/RX and optional LED are not confirmed. Defaults-1 intentionally keep data UART/LED disabled; candidate binary is not a deployable verified wiring design. Controller/mainboard absent, so PS4 pairing, NVS retention, automatic reconnect, UART signal quality, end-to-end deadlines and robot disarm are unverified. Any binary distribution needs review of GPL-3.0-or-later PS4Bluepad32 obligations; no licensed source was copied into repository. External ZIP temporarily extracted outside workspace with LICENSE preserved. Do not treat successful compile as runtime freshness or hardware safety proof.

## 6. Files to Commit

Only source/tests/JSON vectors/Markdown and ignore rules listed above. Stage list below is exact; existing work remains intact. Review cached diff before committing.

## 7. Files Excluded

`firmware/**/build-output/`, .bin/.elf/.map/.exe and test intermediates, raw `docs/verification/ps4_fast_track_*.log`, existing A1 raw log, node_modules/dist. External ZIP and temporary extracted library stay outside Git. No new library installation or vendored sources.

## 8. Conventional Commit Message

`feat(ps4): add Classic ESP32 bridge publisher and pairing lifecycle`

## 9. User Git Commands (not executed)

```powershell
git add -- .gitignore AGENTS.md README.md docs/PROGRESS.md docs/PS4-RECEIVER.md docs/architecture/PS4_LIBRARY_AUDIT.md docs/verification/PS4_FAST_TRACK_A2_A4.md firmware/ps4_bridge tests/ps4-bridge.test.mjs tests/fixtures/ps4_bridge_vectors.json tools/verify-ps4-bridge.ps1
git diff --cached --stat
git diff --cached --check
git commit -m "feat(ps4): add Classic ESP32 bridge publisher and pairing lifecycle"
git push -u origin HEAD
```

## 10. A5 Hardware Readiness

Software is prepared for **A5 planning**, not automatic execution. **A5 execution BLOCKED** until actual bridge/controller/mainboard, reviewed pin/power configuration and explicit COM/upload permission. Start with isolated bridge input/UART and mainboard neutral-state tests; no motor/servo loads. Verify fresh identical reports, disconnect/stale/reconnect/reset MAC and real timing before any robot-control work. Web Pairing is canceled permanently in this direction; no A5 or unrelated phase started here.
