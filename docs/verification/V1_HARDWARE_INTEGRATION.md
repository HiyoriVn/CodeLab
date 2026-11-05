# Newmania V1 hardware integration — 2026-11-05

**Session stopped at user request; no further hardware work authorized until resumed.** Partial hardware evidence only; not whole-board acceptance. Baseline clean, branch `codex/integrate-bach-ui`, HEAD `9117d00ee3789e9cbef39f540f69ed95ac61096f`. Prior SOFTWARE_ACCEPTED work preserved; previous unavailable-board smoke record is historical.

## H1 preflight

- User reports board now available and explicitly identifies COM4. User confirms markings Newmania Starter V1.0 / ESP32-S3-WROOM-1-N8R2 and motors/servos disconnected. Additional PCB revision not supplied. User explicitly confirmed USB-only/no other external loads and approved only Minimal upload to COM4. USB ID alone does not confirm PCB or N8R2 module.
- Arduino CLI board list: COM4, serial USB, VID303A/PID1001, exit0. Windows PnP: `USB Serial Device (COM4)`, `USB\VID_303A&PID_1001&MI_00\6&19F03AC9&0&0000`, status OK. No port opened. Initial restricted CIM query denied; read-only query with approved execution succeeded.
- CLI1.5.1 commit01f3d4f2b; installed `esp32:esp32` Core3.3.7, both commands exit0. No updates/install/configuration changes. Arduino data/downloads set only in process to Arduino15 and staging.
- Intended registry profile: `newmania-starter-v1`, ESP32-S3-WROOM-1-N8R2, flash8MB/QSPI PSRAM2MB. FQBN `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=enabled,USBMode=hwcdc,CDCOnBoot=cdc`. Profile unchanged; physical flash/PSRAM remain unmeasured.

Local ignored logs: `newmania_v1_integration_preflight.log`, `newmania_v1_integration_usb.log`, `newmania_v1_integration_minimal_compile.log` under this directory.

## Test matrix

| Test | Expected | Compile this session | Upload / observed | Status |
|---|---|---|---|---|
| H1 detection | COM4 USB enumerated, board identity/load isolation confirmed | Not applicable | COM4 present, PnP OK; V1.0/N8R2 markings and motor/servo removal user-confirmed; USB-only/no other loads confirmed; memory identity discrepancy under review | PARTIAL PASS |
| H2 Minimal | Boot; motor/buzzer LOW and servo Hi-Z after startup; no PWM | PASS exit0 | Upload PASS exit0, data hashes verified, RTS reset and COM4 reported by CLI; user reports no abnormality; GPIO levels/boot continuity unmeasured | UPLOAD PASS / observation recorded |
| H2 Blink47 (experimental profile) | 500ms HIGH / 500ms LOW on LED47 | PASS exit0, program313594 B, globals22532 B, BIN313744 B | Individually approved upload PASS exit0/hash verified; user confirms correct blink and no abnormality | PASS observed by user, timing not instrument-measured |
| H2 Serial Hello (experimental) | Hello each1s at115200 | PASS exit0, program313678 B, globals22532 B, BIN313824 B | Individually approved upload exit0; many complete Hello lines captured115200, port closed | PASS observed serial messages; exact cadence not measured |
| H2 PSRAM runtime (diagnostic before Blink) | Original profile expects1/2097152/8388608 | PASS exit0, program312238 B, globals22172 B, BIN312384 B | Upload PASS exit0/hash verified; Serial repeatedly PRESENT0, PSRAM0, FLASH16777216 | FAIL memory expectation; upload/Serial PASS |
| Isolated memory probe | Candidate16MB/OPI, no board GPIO init; record uptime/actual memory | PASS exit0, program313970 B, globals22540 B, BIN314112 B | Individually approved upload PASS exit0/hash verified; Serial PRESENT1/PSRAM8388608/FLASH16777216 | PASS initialization/size/transport; not full RAM integrity |
| H3 end-to-end (manual guided) | Blockly -> C++ -> HTTP -> CLI -> USB -> board; UI Serial and stale-build guards | User reports CodeLab compile success | User confirms UI upload COM4, correct LED blink, Serial Monitor115200 connected; HTTP buildId not captured | PASS core chain/user-reported; browser RX not tested, manual stale guards PASS per user |
| H4 Digital GPIO1 | Stable verified logic levels, not floating | Not run | User lacks sufficient tools/pin identification; experimental profile blocks GPIO1 | BLOCKED wiring/tools; not FAIL |
| H4 ADC GPIO1 | Verified safe reference with recorded raw values | Not run | User lacks sufficient tools/reference/pin identification; ADC capability disabled | BLOCKED wiring/tools; not FAIL |
| H4 PWM LED47 | LED-only PWM observation,5kHz/8-bit duty32 | PASS exit0, program321401 B, globals22676 B, BIN321552 B | No upload or observation; user explicitly stopped instead of approving PWM | DEFERRED by user; compile PASS only |

## Prepared Minimal

Existing source: `firmware/newmania_v1/examples/minimal/minimal.ino`. Reviewed: servo12–15 INPUT/FLOATING, motor35–42 and buzzer17 preloaded LOW before OUTPUT; setup halts on startup failure; Serial115200; empty loop. No PWM, motor/servo enable, sensors, PS4 or external DC. This is the existing accepted V1 example, not the earlier empty Phase02.1 V2 toolchain sketch. Electrical states before firmware initialization still require circuit/measurement verification.

Compile command (no upload): absolute installed CLI with `compile --fqbn <V1 FQBN above> --output-dir firmware/newmania_v1/examples/minimal/build-output firmware/newmania_v1/examples/minimal`. PASS exit0: program311,846 /3,342,336 B; globals22,164 /327,680 B, remaining305,516 B. Binary312,000 B. Source SHA256 `51204EE313B6AA3A78352DB917E01E54AB8786F94BC8FF3DDC83C1596A08299F`; binary SHA256/build identifier `F798B6C8C1064F499DFC65302D4684F0487DB585B94A681E4374EB0E4033CFFC`. Raw output/hashes retained in compile log. Specific Minimal/COM4 upload approval granted and executed, exit0. Upload log: `docs/verification/newmania_v1_integration_minimal_upload.log`. Esptool5.1.0 connected ESP32-S3 QFN56 revisionv0.2, USB-Serial/JTAG, wrote/verified all segments and hard-reset; CLI reports new upload port COM4. No Serial/runtime PASS inferred. Firmware build identifier will use binary SHA256; no HTTP build ID for this direct CLI preflight.

## Memory identity discrepancy — diagnostic preparation

Esptool reports **Embedded PSRAM8MB (AP_3v3)**, conflicting with user-confirmed N8R2 marking/profile QSPI2MB. This is uploader chip-feature decoding, not measured runtime memory capacity. Do not silently change profile or assume either memory configuration verified. User could not clarify markings; prepare the existing PSRAM runtime diagnostic under unchanged profile, then request individual upload/Serial approval before Blink. This diagnostic is a focused exception to the normal Minimal/Blink/Serial/PSRAM order to investigate the discrepancy, not automatic continuation. User reports no observed abnormality after Minimal, but cannot independently confirm full module suffix. This is a user observation only, not a GPIO/boot-loop measurement. Espressif esptool v5.1.0 source confirms get_psram_cap reads eFuse fields; get_chip_features maps capacity code1 to8MB, code2 to2MB, vendor1 toAP_3v3. Source: https://github.com/espressif/esptool/blob/v5.1.0/esptool/targets/esp32s3.py (reviewed2026-11-05). This is evidence to investigate, not proof of memory interface or runtime size. No application bug fixed or toolchain/profile changed.

Diagnostic build: existing `firmware/newmania_v1/examples/psram_runtime/psram_runtime.ino`, unchanged V1 FQBN. Source SHA256 `7870F90EF71707CABC9917E5AFEFDB56CAFDF912748D35844EE6BBF3AEDF7282`; BIN SHA256 `90171CED77FA80E49D1251EFF6FCA83DEF24F6A6179B4ED8C7DBDC2FFF0A0857`. Compile command/output/exit/hashes in local ignored `newmania_v1_integration_psram_compile.log`. Individual COM4 upload and Serial read explicitly approved and completed. Upload exit0/data hashes verified/RTS reset, port remains COM4. Serial capture COM4/115200/8N1, DTR=false/RTS=false, 12s, no bytes sent; repeated `PSRAM_PRESENT=0 PSRAM_BYTES=0 FLASH_BYTES=16777216`. Capture completed, port closed/disposed. Logs: `newmania_v1_integration_psram_upload.log`, `newmania_v1_integration_psram_serial.log` (ignored). QSPI PSRAM initialization failed; this is not proof of absent/defective RAM. Flash size reported by runtime is16MB. No full memory-integrity test performed.

## Focused memory diagnosis candidate — no profile change

Runtime reports16MB flash; uploader eFuse decode reports8MB PSRAM AP_3v3. This suggests a different memory variant, possibly N16R8, but does not establish full module identity. Espressif documents N16R8 with16MB flash/8MB Octal PSRAM and reserves GPIO35–37 for internal memory on Octal modules: [official guide](https://documentation.espressif.com/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html). Existing V1 startup configures35–37 as motor outputs, so it must not be reused unchanged for an OPI probe. Stop Blink/other V1 startup examples until this conflict is resolved.

New isolated `firmware/verification/v1_memory_probe/v1_memory_probe.ino` only starts USB Serial and prints uptime/PSRAM/flash once per second; no board GPIO init, driver, PWM or bus. It intentionally omits V1 SafeStartup to avoid touching candidate memory pins. Requires USB-only/all loads disconnected; this is not a substitute board safety startup or validated motor/servo electrical state. Compile candidate `esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=opi,USBMode=hwcdc,CDCOnBoot=cdc`; retain existing8MB partition layout for this small probe, leaving remaining flash unused. Registry and accepted firmware untouched. Installed Core3.3.7 boards.txt explicitly defines16M and opi; no voltage/eFuse changes. Compile PASS exit0, program313970 /3342336 B, globals22540 /327680 B, BIN314112 B. Source SHA256 `2EF1BA1BC553F3328959BB046216E9ED6FD2E6416B1F058DDB76F0684D2C7BC2`; BIN/build identifier `0584BFF4DBAD71305636AF7D40A651283EDB0EE6E2A27027C49D30196AAB12CB`. User explicitly approved this probe and Serial; upload PASS exit0, data hash verified, RTS reset/COM4. Capture115200/8N1, DTR/RTSfalse,12s, no bytes sent; port closed/disposed. Logs `newmania_v1_integration_memory_probe_compile.log`, `_upload.log`, `_serial.log` (ignored). Fourteen complete parsed frames consistently report PRESENT1/PSRAM8388608/FLASH16777216; uptime increases12109..26109ms, no observed reset in this window. Initial partial frame excluded; one interval absent, not treated as a loss-free stream. This verifies runtime initialization/reported size only, not memory integrity or board variant/pinout.

## Authorized experimental profile and Blink acceptance

Owner approved adding separate `newmania-v1-16m-opi-experimental`; original V1 N8R2/V2/Generic definitions deep-equal HEAD, startup outputs identical to HEAD (direct comparisons PASS). New profile memory/build matches probe, exact module suffix unverified; only GPIO47 Digital/PWM plus USB Serial. All other GPIO reserved, motors/servos/ADC unavailable. Startup policy `no-board-gpio` does no motor/buzzer/servo initialization; only explicit LED blocks configure47. This restricted test policy requires USB-only/no loads; does not establish a general robot safe startup. Toolbox hides unsupported motor/servo/ADC blocks; imported blocks retained but diagnosed, no remap. No default/old project profile changed.

`npm test` **32/32 PASS exit0**, `npm run build` **PASS exit0**,62 modules, existing bundle/deprecation warnings. Added five regression tests including HTTP stale-profile guard. Derived minimal/Blink/Serial Hello/PWM LED examples reuse existing Blockly source helpers under separate experimental board metadata. New sample generator: `node tools/v1-opi-examples.mjs`. Experimental minimal not yet compiled/uploaded; Serial Hello now compiled/uploaded with individual approval and captured successfully.

Blink source SHA256 `20DC5822051D9B01C236B99559B39AA7B2F344589DF8DEA7A5E2776DFB0F39F8`; BIN/build identifier `E95B981E3370A55BCDCE7F8F829227646E4A301D45CD4057A565EC91003A1D29`,313744 B. Only pinMode47/digitalWrite47 and500ms delays, no memory/motor/servo GPIO init. User explicitly approved COM4 Blink; CLI upload exit0, hashes verified/RTS reset/new portCOM4. User then confirms LED Blink matches expected cadence, no abnormality. Physical observation is user-reported; no scope trace or measured electrical levels. Logs `newmania_v1_integration_opi_blink_compile.log` and `_upload.log` ignored.

Serial Hello source SHA256 `35EEA95A8B8610BF96A955A40545F025E1D0F561C8384B4038C5886F8087C8AB`; BIN/build identifier `FC477FBB1215DD9B259232FE4C3A97B1ED34F0F0AE947155D813D8C2895174BC`. Compile/upload exit0; user explicitly approved COM4 + Serial. Repeated `Hello, Newmania!` in8s capture with DTR/RTSfalse, no data sent, closed/disposed afterward. Buffered initial partial line discarded; do not infer exact1Hz cadence from a buffered capture. Logs `newmania_v1_integration_opi_serial_compile.log`, `_upload.log`, `_capture.log` ignored.

H3 preparation: production CodeLab/HTTP bridge started at127.0.0.1:8787 with correct process-local CLI/data env. UI displays experimental profile. Automated file chooser blocked by Chrome extension file-URL access permission; no permission changed. User reports imported GPIO47/500ms blocks on8787 and closing5173, but automation continues to see old empty8787/PS4-on5173 snapshots. No UI fault attributed to app without evidence; browser-control view cannot verify user changes. Manual guided H3 continues: user reports selecting/compiling on8787 and then proactively uploading successfully via UI. User action constitutes this upload approval; the agent did not issue another upload. UI HTTP buildId/binary hash not exposed/captured, so cannot equate artifact with earlier direct-CLI hash. User confirms COM4/LED and Serial Monitor connected at115200; Blink sends no text so browser receive-data not verified. No automatic browser PASS claimed. Record user-reported vs automatically observed results separately. Do not confuse existing localhost5173 editor with8787 origin (separate browser storage).

H3 actual user confirmation: compile/upload succeeded through CodeLab on8787, COM4, LED47 blinks correctly; browser Serial Monitor connects115200, no commands sent. No browser RX-data claim because Blink is silent. User confirms both switching profile and editing code block upload until recompile; no stale-image upload attempted. PWM LED47 fixture compile PASS only; user stopped the session instead of granting upload permission. No H4 upload authorized or performed.

## Final session checkpoint / deferred PWM

User explicitly requested stopping tests for another time. No PWM upload/Serial/device actions afterward. HTTP bridge started by this session was stopped; browser can remain open but compile/upload requires restarting bridge when resumed. Last known firmware is user-uploaded experimental Blink; source/profile test edits did not upload. LED firmware continues while board powered; stopping host bridge does not stop board firmware.

H3 core chain and source/profile guards **PASS per user report**, not automatically observed browser evidence. Monitor connection PASS; browser receive-data remains untested on silent Blink. Direct Serial Hello receive PASS via host log. UI HTTP buildId/binary hash not captured; earlier CLI artifacts have hashes above. No full USB-disconnect/error matrix, oscilloscope timing, before-boot GPIO levels, full RAM integrity, ADC/Digital or motor/servo tests.

PWM source SHA256 `E657277DE48F765B456257FC13ADDB5A59EC642F907377D46CDBCD30AB044553`; BIN/build identifier `DAFEEF213BE2AB1F364C7AA876F637D3CAA8D0D73821028B36578CB71976B564`. Compile command/exit/memory/hash in ignored `newmania_v1_integration_opi_pwm_compile.log`. No PWM upload log because no upload occurred.

## Commit-ready scope / continuation

Files to commit (current session, 23 files):

- `AGENTS.md`
- `README.md`
- `docs/PROGRESS.md`
- `docs/TESTING.md`
- `docs/boards/BOARD_PROFILES.md`
- `docs/boards/V1_HARDWARE_TEST.md`
- `docs/verification/V1_HARDWARE_INTEGRATION.md`
- `firmware/verification/v1_memory_probe/v1_memory_probe.ino`
- `firmware/verification/v1_opi_examples/blink/blink.codelab.json`
- `firmware/verification/v1_opi_examples/blink/blink.ino`
- `firmware/verification/v1_opi_examples/minimal/minimal.codelab.json`
- `firmware/verification/v1_opi_examples/minimal/minimal.ino`
- `firmware/verification/v1_opi_examples/pwm_led/pwm_led.codelab.json`
- `firmware/verification/v1_opi_examples/pwm_led/pwm_led.ino`
- `firmware/verification/v1_opi_examples/serial_hello/serial_hello.codelab.json`
- `firmware/verification/v1_opi_examples/serial_hello/serial_hello.ino`
- `src/blocks/robotics-toolbox.js`
- `src/boards/profiles.js`
- `src/boards/startup.js`
- `tests/board-profiles.test.mjs`
- `tests/bridge.test.mjs`
- `tests/v1-opi-profile.test.mjs`
- `tools/v1-opi-examples.mjs`

Raw integration logs and firmware build-output ignored; no binaries staged. No accepted native firmware/PS4 change, motor/servo test, commit or push. Original three profiles/startup outputs preserved; a separately authorized experimental registry entry/toolbox/startup policy added. Only individually approved Minimal, existing QSPI diagnostic, isolated OPI probe experimental LED Blink and Serial Hello uploads were performed.

Suggested commit after reviewing actual session results: `feat(boards): add experimental OPI profile and verify V1 blink`

```powershell
git add -- AGENTS.md README.md docs/PROGRESS.md docs/TESTING.md docs/boards/BOARD_PROFILES.md docs/boards/V1_HARDWARE_TEST.md docs/verification/V1_HARDWARE_INTEGRATION.md firmware/verification/v1_memory_probe/v1_memory_probe.ino firmware/verification/v1_opi_examples/blink/blink.codelab.json firmware/verification/v1_opi_examples/blink/blink.ino firmware/verification/v1_opi_examples/minimal/minimal.codelab.json firmware/verification/v1_opi_examples/minimal/minimal.ino firmware/verification/v1_opi_examples/pwm_led/pwm_led.codelab.json firmware/verification/v1_opi_examples/pwm_led/pwm_led.ino firmware/verification/v1_opi_examples/serial_hello/serial_hello.codelab.json firmware/verification/v1_opi_examples/serial_hello/serial_hello.ino src/blocks/robotics-toolbox.js src/boards/profiles.js src/boards/startup.js tests/board-profiles.test.mjs tests/bridge.test.mjs tests/v1-opi-profile.test.mjs tools/v1-opi-examples.mjs
git diff --cached --check
git commit -m "feat(boards): add experimental OPI profile and verify V1 blink"
git push origin codex/integrate-bach-ui
```

Next action only when user resumes: continue from this record, recheck port/power/no-load state and explicitly approve any new upload. H4 digital/ADC are blocked until physical wiring is verified and explicit profile scope expanded; PWM only LED47 after H2/H3. Existing N8R2 examples remain unsuitable for this observed variant; no blanket hardware acceptance or upload approval.
