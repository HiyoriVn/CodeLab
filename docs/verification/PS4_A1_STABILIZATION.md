# PS4 A1 — Generator Stabilization

2026-11-05. [Issue #18](https://github.com/HiyoriVn/CodeLab/issues/18), **A1 only**. Baseline `7b35678dc197a864c6a7567af6ec03dba9363c02`, initial worktree clean. **A1 SOFTWARE_ACCEPTED / HARDWARE_UNTESTED.** A2 is not implemented, issue18 as a whole is not marked complete.

## Implementation Summary

Reproduced on the baseline: a headless Blockly UART workspace returned `Cannot set properties of undefined (setting 'ps4_stdio')`. Added a per-generation `includes_` dictionary; used String.raw for the C++ helper so LF/CR/NUL escape sequences remain actual C++ source escapes, with no NUL bytes embedded in output. Golden sketch covers UART init plus connected/axis/button expressions; a read-only connected block now also requests polling preamble.

Replaced sscanf/clamping UART parsing with bounded decimal parsing. Only six complete LF/CRLF-terminated fields are committed; reject missing/extra fields, whitespace/plus signs, invalid connected values, signed16 axis overflow, unsigned32 button overflow/negative values, embedded NUL and overlong data. Invalid/partial lines never refresh last-valid timestamp. Buffer remains96 bytes including NUL; overlong/NUL input discards until LF, then recovers. No protocol version/CRC/binary field or mask/range change.

Initial accessors are neutral; valid connected=0 clears axes/buttons immediately. Connected reports remain current through250ms inclusive, neutral after250ms; millis rollover covered. Neutral accessors do not directly stop robot outputs. CSV v1 cannot distinguish new identical reports from stale valid CSV replay: A2 publisher must enforce actual controller-report freshness and never manufacture fresh reports from heartbeat/cache. No replay protection claim.

Concrete profile UART1 pair is allowed specifically for the PS4 UART block: V2 TX6/RX7, V1 TX18/RX21. Wrong profile pins still warn; normal reserved-pin restrictions and role-conflict checks remain. No pin remapping, workspace/schema/block-type changes, robotics-driver or UI changes. I2C remains legacy, not the selected transport; binary13-byte decoder semantics are not redesigned in A1.

Library source rechecked at `C:/Users/Admin/Documents/ps4-esp32-lib-main.zip`: PS4Bluepad321.0.1, Bluepad32 and Preferences dependencies, GPL-3.0-or-later per prior audited source. No vendoring or install. No `PS4_ESP32_WebPair.ino` found in workspace; no pairing firmware is treated as this library. The mainboard sketch needs Arduino/Wire, not Bluepad32; actual PS4 Bluetooth remains on separate ESP32.

## Verification Results

- `npm test`: **18/18 PASS**, exit0. Existing15 profile/V1/HTTP/native startup tests remain passing. Three A1 tests: golden generation/dedup/escapes/profile selection; host compile/run of the actual generated C++ parser with fake UART/clock; isolated controller reads without configuration produce a useful warning instead of exception.
- Native parser test executes boundary axes/buttons, LF/CRLF, partial frames, malformed fields, overflow, NUL/overlong resync, malformed heartbeat, disconnect clearing, initial/time0 neutrality,250/251ms cutoff and unsigned clock rollover. This executes generated helper code, not an independently rewritten parser.
- `npm run build`: **PASS**, exit0, Vite7.3.7,61 modules,4.39s. Existing chunk>500kB warning and Blockly getAllVariables deprecation remain.
- `node tools/verify-ps4-a1.mjs`: **PASS**, script exit0. Deterministic Blockly workspace with PS4 UART RX7/TX6/115200 and all three read types -> golden `.ino` -> real CodeLab HTTP `/api/compile` -> pinned Espressif Core3.3.7 -> nonempty binary. CLI version checked directly: **1.5.1**. FQBN `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled`. CLI success requires child exit0. BIN **313,296 B**, program **313,155 / 3,342,336 B (9%)**, globals **22,988 / 327,680 B (7%)**, free304,692 B.
- Process-local Arduino data `C:/Users/Admin/AppData/Local/Arduino15`, downloads its staging folder; approved out-of-sandbox execution for existing compiler/localhost. No installs or configuration changes. Raw command result/stdout/stderr/FQBN/binary size/exit in `docs/verification/ps4_a1_compile.log` (ignored).
- No port list, COM selection, upload, firmware execution or hardware test in A1. No PS4 pairing or bridge compile. Pure PS4Bluepad32-to-CSV mapping vectors belong to A2 and are not counted as A1 acceptance.

Reproduce compile-only on Windows (after npm dependencies already installed):

```powershell
$env:ARDUINO_CLI_PATH='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS='C:\Users\Admin\AppData\Local\Arduino15\staging'
node tools/verify-ps4-a1.mjs
npm test
npm run build
```

## Files Changed / Files to Commit

`.gitignore`, `AGENTS.md`, `README.md`, `src/generators/arduino.js`, `tests/ps4-workspace.mjs`, `tests/ps4-generator.test.mjs`, `tests/fixtures/ps4_uart.ino`, `tools/verify-ps4-a1.mjs`, `docs/PS4-RECEIVER.md`, `docs/architecture/PS4_LIBRARY_AUDIT.md`, `docs/PROGRESS.md`, this report. Golden `.ino` is mainboard receiver source, not bridge firmware. Exclude raw logs, binaries and host-generated intermediates under existing build-output ignore rules.

## Commit Message and Commands

Commands for the user, not executed by this task:

```powershell
git add -- .gitignore AGENTS.md README.md src/generators/arduino.js tests/ps4-workspace.mjs tests/ps4-generator.test.mjs tests/fixtures/ps4_uart.ino tools/verify-ps4-a1.mjs docs/PS4-RECEIVER.md docs/architecture/PS4_LIBRARY_AUDIT.md docs/PROGRESS.md docs/verification/PS4_A1_STABILIZATION.md
git diff --cached --check
git commit -m "fix(ps4): stabilize UART CSV v1 generation and parsing"
git push -u origin HEAD
```

## Next Task A2 Readiness

**READY_FOR_A2 software contract/mapping tests. BRIDGE_COMPILE_PENDING / HARDWARE_UNTESTED.** Next: pure axis/button conversion vectors from PS4Bluepad321.0.1 and simulated publisher freshness rules, without changing CSV v1. Exact bridge chip/board/UART pins/power/package target remain unknown; do not invent a bridge target or use Bluetooth Classic directly on S3. A1 stops here; no A2 firmware or mapping implemented automatically.
