# Newmania V1 hardware smoke test — 2026-11-05

**Overall: BLOCKED (hardware unavailable, user confirmed).** SOFTWARE_ACCEPTED from the preceding fast track is retained; **HARDWARE_UNTESTED / PENDING_HARDWARE_VALIDATION** remains. No board, motor, servo, USB device or COM port was opened, selected or uploaded to. No commit/push or other phase work.

## Preflight evidence

Read AGENTS.md and V1_HARDWARE_TEST.md. Initial worktree clean, branch `codex/integrate-bach-ui`, HEAD `642354fb551ca0f21ee2976271c92e11dd6ce740`. Existing completed work was preserved.

- Arduino CLI **1.5.1**, commit01f3d4f2b: version command exit0.
- `core list`: **esp32:esp32 3.3.7** installed, exit0. Bluepad32 Core4.1.0 not used. No tools installed/updated.
- Registry profile `newmania-starter-v1`: ESP32-S3-WROOM-1-N8R2, flash8MB, PSRAM2MB QSPI. FQBN `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=enabled,USBMode=hwcdc,CDCOnBoot=cdc`.
- `board list --format json`: exit0, `{"detected_ports":[]}`. Same result inside sandbox and in approved out-of-sandbox process, avoiding a conclusion based on sandbox discovery alone.
- User explicitly confirmed: **“Chưa có board, ghi BLOCKED phần hardware.”** No port confirmation or upload approval has been given.
- Process-only `ARDUINO_DIRECTORIES_DATA=C:/Users/Admin/AppData/Local/Arduino15`; downloads its `staging` subdirectory. No IDE/OpenBlockDesktop/global environment change.

Local raw log: `docs/verification/newmania_v1_smoke_preflight.log` (ignored by existing rule).

Actual read-only commands, using the absolute CLI path below:

```powershell
$cli='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS='C:\Users\Admin\AppData\Local\Arduino15\staging'
& $cli version
& $cli core list
& $cli board list --format json
```

## Per-test record

Paths below are under `firmware/newmania_v1/examples/`. For the six existing Blockly examples, compile PASS is **historical fast-track evidence**, not a new run in this hardware session; [fast-track report](NEWMANIA_V1_FAST_TRACK.md) lists the actual sizes and software tests. No hardware result is inferred from those builds.

| Order/test and firmware | Compile | Upload | Actual observation | Test status / error / next step |
|---|---|---|---|---|
| 1 Minimal: `minimal/minimal.ino` + JSON | PASS prior fast track | Not attempted | No board, no COM | BLOCKED; connect board, confirm COM, approve Minimal upload first |
| 2 Blink47: `blink/blink.ino` + JSON | PASS prior fast track | Not attempted | No LED observation | BLOCKED; requires successful Minimal and separate upload approval, observe LED47 500ms HIGH/LOW |
| 3 Serial115200: `serial_hello/serial_hello.ino` + JSON | PASS prior fast track | Not attempted | No serial session/data | BLOCKED; confirm COM/USB topology, approve upload, observe Hello every1s |
| 4 PSRAM runtime: `psram_runtime/psram_runtime.ino` | PASS in this session, exit0 | Not attempted | No memory result from device | BLOCKED hardware; expected PRESENT1, PSRAM2097152 B, flash8388608 B |
| 5 Digital input: `digital_input/digital_input.ino` + JSON | PASS prior fast track | Not attempted | No GPIO1 wiring or levels verified | BLOCKED; confirm wiring/3.3V logic and preceding tests, approve upload |
| 6 ADC: `adc_read/adc_read.ino` + JSON | PASS prior fast track | Not attempted | No ADC measurements | BLOCKED; confirm safe source/reference, approve upload; do not test floating input |
| 7 PWM LED: `pwm_led/pwm_led.ino` + JSON | PASS prior fast track | Not attempted | No LED waveform/brightness observation | BLOCKED; approve upload only after earlier tests; GPIO47 only |

All uploads must remain user-selected/user-approved per test. The intended integration method for rows1/2/3/5/6/7 is importing the matching JSON, selecting V1, reviewing generated code, HTTP `/api/compile`, then explicit `/api/upload` only after confirmed COM and approval. No upload request was sent in this session. If identity/source/profile changes after a build, recompile before approval. Native PSRAM diagnostic is an additional standalone sketch (no new Blockly block) compiled by the command below.

## PSRAM diagnostic compile evidence

Added an independent read-only diagnostic based on the existing V1 generated startup. It preserves motor/buzzer LOW, servo Hi-Z, no PWM/enable API, and prints once per second:

```text
PSRAM_PRESENT=<psramFound()> PSRAM_BYTES=<ESP.getPsramSize()> FLASH_BYTES=<ESP.getFlashChipSize()>
```

This only reports initialization/detected sizes, not a full RAM read/write integrity test. Expected sizes come from the profile; **no runtime values have been measured**. A physical mismatch must be recorded as FAIL, with module marking/USB/power/config investigation; do not silently alter the core or profile to claim a pass.

Actual compile command (approved out-of-sandbox execution, same installed toolchain; no port/upload):

```powershell
& $cli compile --fqbn 'esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=enabled,USBMode=hwcdc,CDCOnBoot=cdc' --output-dir firmware/newmania_v1/examples/psram_runtime/build-output firmware/newmania_v1/examples/psram_runtime
```

**PASS, exit0**. Sketch program312,238 / 3,342,336 B (9%); globals22,172 / 327,680 B (6%), free305,508 B. `.ino.bin` exists,312,384 B; ELF/partitions/merged binary produced as build artifacts. Raw stdout/stderr/command/exit in `docs/verification/newmania_v1_smoke_psram_compile.log` (ignored). This is compile evidence only, not runtime detection PASS.

## CodeLab integration status

| Segment | Evidence this session | Status |
|---|---|---|
| Board profile and build options | Registry checked, CLI/Core rechecked | PASS preflight |
| Blockly -> C++ -> HTTP -> CLI -> binary, profile switching, error/stale-build guards | Prior software acceptance report, no new browser/host-suite run needed for unchanged application | SOFTWARE_ACCEPTED historical |
| CLI -> USB -> actual board | No board/COM/approval | BLOCKED |
| UI upload and Serial Monitor with real device | No upload or port opened | BLOCKED |
| Real device after source/profile switch, USB errors/reconnect | Not observed on hardware | BLOCKED, not claimed PASS |

Motor/servo testing remains outside this task and needs a separate power-safety task. DC3–15V board input is not evidence that kit3–6V motors may receive that input voltage.

## Commit-ready Summary

**Implementation Summary:** completed read-only preflight, added/compiled safe PSRAM/flash diagnostic, recorded unavailable hardware and per-test blockers. Existing app, V2 firmware and PS4 bridge/generator were not changed.

**Verification Results:** CLI/core/ports commands exit0; no detected ports; PSRAM sketch compile exit0/binary present. Documentation diff/ignore checks are recorded in PROGRESS. No hardware PASS or new complete end-to-end hardware claim.

**Files Changed / Files to Commit:**

- `docs/PROGRESS.md`
- `docs/boards/V1_HARDWARE_TEST.md`
- `docs/verification/NEWMANIA_V1_HARDWARE_SMOKE.md`
- `firmware/newmania_v1/README.md`
- `firmware/newmania_v1/examples/psram_runtime/psram_runtime.ino`

**Files Excluded:** both `docs/verification/newmania_v1_smoke_*.log`, `firmware/**/build-output/`, binary/ELF/map/executables and existing dependency/dist outputs remain ignored. No DOCX/image source attachment was copied to Git.

**Commit Message:** `test(v1): record smoke preflight and add PSRAM runtime diagnostic`

Commands below are for the user; none was executed by this task:

```powershell
git add -- docs/PROGRESS.md docs/boards/V1_HARDWARE_TEST.md docs/verification/NEWMANIA_V1_HARDWARE_SMOKE.md firmware/newmania_v1/README.md firmware/newmania_v1/examples/psram_runtime/psram_runtime.ino
git diff --cached --stat
git diff --cached --check
git commit -m "test(v1): record smoke preflight and add PSRAM runtime diagnostic"
git push -u origin HEAD
```

**Remaining Issues:** hardware not yet available; COM identity and upload approvals pending; USB topology/PSRAM runtime/GPIO levels unknown. Known PS4 generator issues from fast track remain out of scope.

**Next Task:** resume this same smoke sequence when V1 arrives: connect USB with loads disconnected, list ports, get explicit COM confirmation and approve Minimal upload first. Continue one test at a time with recorded observations. Do not start another firmware phase or motor/servo task automatically.
