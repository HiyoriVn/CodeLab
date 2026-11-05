# Progress - hardware/firmware roadmap

## Integrated working-demo attempt — 2026-11-05 — UART_READY_FOR_REWIRE / ACTUATORS_BLOCKED

- One mainboard demo `firmware/demos/newmania_ps4_mecanum/newmania_ps4_mecanum.ino` reuses canonical CSV parser, RobotController/MecanumMixer/ServoController; USB monitor/commands, explicit SIM mode,15% logical RZ7899 PWM cap. No real motor/servo output, no GPIO35–37 or profile change. No working four-motor hardware claim.
- User identified onboard RZ7899 and supplied reference schematic/pin tables; manufacturer truth table10 forward/01 reverse/00 coast/11 brake verified. Old M1/M2 pins35–37 still conflict with observed16MB/OPI unit; actual PCB routing unresolved. Servo signal/power stability also not verified. Hardware backend and motor/servo tests remain BLOCKED.
- User confirms former D1 connection was I2C and authorizes preparing rewire: D1 TX21 -> S3 reference RX21, D1 RX22 <- S3 reference TX18, commonGND, no power tie. Rewire not performed/observed. Default UART disabled; separate UART-enabled compile candidate provided. Stock ZIP SerialMonitor prints text, not CSV; exact running D1 image unknown. Reused unchanged A2–A4 bridge/pairing/MAC/library with proposed data pins.
- Host tests **37/37 PASS**, web build **PASS**, exit0. CLI1.5.1: default S3 demo/Core3.3.7 compile PASS (BIN343152 B), UART-enabled S3 PASS (BIN352064 B), existing Classic bridge/Core4.1.0 TX21/RX22 PASS (BIN725632 B), all exit0/nonempty binaries. [Detailed evidence/blockers](verification/WORKING_MECANUM_DEMO.md), [short wiring/test instructions](../firmware/demos/newmania_ps4_mecanum/README.md).
- No COM open/flash/upload, actual PS4/UART/load test, toolchain install/update, commit/push or further phase. Prior stopped hardware session remains stopped. Compile readiness does not establish a moving robot.

## PS4 mecanum controller — 2026-11-05 — SOFTWARE_ACCEPTED (mock only)

- Portable C++ MecanumMixer, RobotController DISARMED/ARMED/FAULT, deadzone/per-wheel acceleration and logical ServoController with motor/servo interfaces/mock implementations. Defaults/signs/button bindings are software proposals, not verified chassis settings. D-pad never auto-enables servo; explicit enable+confirmed power required. Reconnect never arms, FAULT remains latched until explicit neutral/fresh recovery.
- Reused existing CSVv1 bridge publisher and canonical parser. Two read-only parser freshness getters added; parsing/normalization untouched, no poll-based timestamp refresh. Actual publisher -> parser -> controller tested with fake serial/clock; >250ms report timeout, wrap/stall, stop without ramp, bounds/backend failures covered. No real GPIO/PWM/servo backend or motor truth table inferred.
- `npm test` **34/34 PASS**, `npm run build` **PASS**, exit0. CLI1.5.1/Core3.3.7 simulation sketch compile **PASS exit0** on unchanged experimental16MB/OPI profile: program341078 B, globals24220 B, BIN341232 B. First compile macro collision INPUT fixed and host guarded. Logs/binaries ignored. No COM access/flash/upload, bridge/profile/native firmware changes, commit/push or hardware session resumption.
- **HARDWARE_ACTUATION_BLOCKED**:35–37 reserved for candidate Octal memory; all actuators mock, UART uninitialized in compile sketch, servo power/signal unverified. [API/tests/state policy/wiring gates/compile evidence](robotics/PS4_MECANUM.md). Stop after this software task; no automatic driver or hardware phase.

## V1 hardware integration — 2026-11-05 — STOPPED BY USER (partial hardware acceptance)

Board now available per user; COM4 explicitly identified. CLI detects COM4 VID303A/PID1001, Windows PnP OK. CLI1.5.1/Core3.3.7 verified directly; V1 FQBN unchanged (8MB/QSPI enabled/USB CDC). User confirms V1.0/N8R2 markings and motors/servos removed; USB-only/no external loads and Minimal COM4 upload explicitly approved. Minimal compile PASS exit0, BIN312,000 B; Minimal upload PASS exit0, hashes verified, RTS reset/COM4 reported. Serial/runtime/GPIO observation pending. **Hold further uploads:** esptool reports Embedded PSRAM8MB AP_3v3, conflicting with N8R2/QSPI2MB; user reports no abnormality but cannot clarify suffix; profile unchanged. Existing PSRAM runtime diagnostic compile/upload PASS exit0; Serial115200 captured repeated PRESENT0/PSRAM0/FLASH16777216: memory expectation FAIL, transport PASS. Separate no-GPIO16MB/OPI probe compile/upload PASS exit0 with individual approval; Serial reports initialized PSRAM8388608 B/Flash16777216 B,14 complete samples with increasing uptime12109..26109ms. No full RAM integrity test. GPIO35–37 memory conflict makes old V1 startup unsuitable for this variant. Owner approved separate experimental16MB/OPI8MB profile, LED47/Serial only, no board-GPIO startup. Original three profiles and their startup outputs unchanged (direct comparisons PASS). Host tests32/32 PASS and production build PASS/exit0. Experimental Blink compile/upload PASS exit0, user confirms correct blink/no abnormality. Experimental Serial Hello compile/upload PASS exit0; repeated Hello captured115200. H3 user reports Blink workspace/compile/upload success on8787; browser-control view remains stale, so manual results distinguished from agent-observed hardware logs. User confirms UI COM4 upload/LED blink and Serial Monitor115200 connected; H3 chain and both source/profile stale-upload guards PASS per user, browser RX on silent Blink untested; PWM compile PASS exit0/BIN321552 B only, upload deferred by explicit user stop; H4 digital/ADC BLOCKED: user lacks tools/reference/confirmed pinout, profile still blocks them. HTTP bridge stopped, no further hardware actions; last known firmware Blink. Resume only on new user request. Previous missing-board smoke is historical; HARDWARE_UNTESTED remains until individual tests complete. [Current matrix/logs/commands](verification/V1_HARDWARE_INTEGRATION.md). No source/profile/PS4 changes or commit/push.

Cập nhật 2026-11-05 (Asia/Saigon). Baseline code trước preflight: `codex/integrate-bach-ui` @ `3a81e54aca414524bb949f3b24af6eb3b2e6b88f`. [Báo cáo Phase 01](PHASE01_AUDIT.md), [kế hoạch](IMPLEMENTATION_PLAN.md), [log build Phase 02.1](verification/phase02_1_compile.log).

## Robotics Blocks & Generator Integration — 2026-11-05

- Implemented profile-aware toolbox, motor/servo channel APIs, servo signal disable, digital input pull modes and Serial print/available/read. ADC/PWM follow capabilities; V2 keeps reserved pins. Motor motion/servo enable remain unsupported diagnostics, with no pulses/load commands generated.
- Fixed shared generator dropping chained statements and missing semicolons for standalone expressions. Regenerated five derived V1 C++ examples and PS4 UART golden; native V1/V2, profile registry, PS4 Bridge/parser/protocol unchanged. Workspace version1/legacy block types retained; switching V2 M6 -> V1 preserves M6 and reports error instead of remapping.
- `npm test`: **27/27 PASS, exit0**. `npm run build`: **PASS, exit0** (62 modules; existing chunk/deprecation warnings). Browser smoke PASS for toolbox/channels/profile switching; test workspace restored to initially empty Generic.
- Arduino CLI1.5.1/Core3.3.7 directly checked. **10/10 generated-example compiles PASS, script exit0**, each with nonempty BIN, through HTTP -> CLI; V1 8MB/QSPI enabled, V2 8MB/PSRAM disabled, Generic unchanged defaults. **SOFTWARE_ACCEPTED** for supported blocks/diagnostics only. [Results/memory/commands](verification/ROBOTICS_BLOCKS_INTEGRATION.md); local raw log `docs/verification/robotics_blocks_compile.log` ignored.
- **HARDWARE_UNTESTED / PENDING_HARDWARE_VALIDATION** remains. No truth-table/power assumption, hardware/A5, COM selection, upload, flash, commit/push or next-phase execution. Motor safety/servo power interlock and dedicated sensor drivers remain separate tasks.

## PS4 Fast Track A2 + A3 + A4 — 2026-11-05

- **A2 SOFTWARE_ACCEPTED**: PS4Bluepad321.0.1 axis/17-button mapping, Touchpad exclusion, CSV v1 publisher, report gate and timeout/disconnect/reset behavior. All201 percentage values round-trip through A1 to exact10*p; no second Y inversion, fake fresh heartbeat or cached reconnect control.
- **A3 BRIDGE_CANDIDATE_BUILD_PASSED**, exit0: CLI1.5.1, Bluepad32 core4.1.0, Classic ESP32 `esp32-bluepad32:esp32:esp32`. External ZIP1.0.1 compiled from temporary directory outside repo, hash/version pinned, no vendoring/install. Final program719,069 B, globals87,108 B; BIN725,648 B. Final board/pins/power unknown; TX/RX/LED default-1 and data UART disabled.
- **A4 SOFTWARE_IMPLEMENTED / host gate tests PASS; HARDWARE_UNTESTED**: library pairing/NVS/reconnect, explicit RESET_MAC debug command with disconnect epoch gate. Application MAC reset is not bond deletion. No AP/web server/Web Pairing; no robot-arm or motor/servo controls.
- `npm test` **19/19 PASS**, `npm run build` PASS (existing bundle/deprecation warnings); mainboard UART sketch compile PASS/exit0 with unchanged A1/Core3.3.7/V2 profile, BIN313,296 B. No A1 regression or profile/project/mainboard changes.
- Freshness uses pinned BP32.update boolean and library per-controller hasData, not cached getData success or value changes. SDK API contract verified in installed headers; radio behavior/timing still needs A5. CSVv1 cannot detect arbitrary replay from third-party publisher.
- Review checks PASS: `git diff --check`, documentation links, ignored build/log outputs; no src/A1/profile/mainboard diff or tracked binaries. Earlier BRIDGE_COMPILE_PENDING is superseded for the candidate only, not final hardware.
- **A5 execution BLOCKED**, hardware/COM/upload approval pending. Software ready for A5 planning only. No flash, controller test, COM selection, commit/push or other phase. [Report/build evidence/staging commands](verification/PS4_FAST_TRACK_A2_A4.md), [bridge setup/pairing](../firmware/ps4_bridge/README.md).

## PS4 A1 — Generator Stabilization — 2026-11-05 — PASS

**A1 SOFTWARE_ACCEPTED / HARDWARE_UNTESTED. READY_FOR_A2 software contract/mapping tests; BRIDGE_COMPILE_PENDING.** Issue18 A2 and bridge hardware remain open, not implemented in this task.

- Reproduced/fixed includes_/ps4_stdio and LF/CR/NUL escaping; UART CSV v1 strict bounds/complete-line parsing, neutral disconnect and250ms timeout verified with generated C++/fake UART/clock. Profile-correct UART1 allowed without changing unrelated GPIO rules, workspace format or saved pins.
- `npm test` **18/18 PASS**, `npm run build` PASS. Real generated Blockly UART sketch compiled via CodeLab HTTP bridge with CLI1.5.1/Core3.3.7, V2 Flash8MB/default_8MB/PSRAMdisabled, script exit0. BIN313,296 B, program313,155 B, globals22,988 B.
- PS4Bluepad321.0.1/Bluepad32 on separate ESP32 remains selected; ZIP metadata rechecked, no vendoring/install. No WebPair sketch found in workspace. No direct PS4 Bluetooth on S3, no bridge/mapping implementation, upload or hardware tests.
- CSV v1 cannot detect stale valid CSV replay; A2 publisher must gate freshness on real controller reports, not heartbeat. Hardware V1 smoke remains BLOCKED per prior user confirmation; no new hardware claim.
- [Focused report, evidence, files and commit commands](verification/PS4_A1_STABILIZATION.md). Local raw log `docs/verification/ps4_a1_compile.log` ignored. Historical defects below describe earlier phases; A1 supersedes includes_/escaping/strict UART parser status only.

## V1 Hardware Smoke Test — 2026-11-05 — BLOCKED hardware

- Người dùng xác nhận **chưa có board**. `board list --format json` trả `detected_ports: []`, exit0 cả trong/ngoài sandbox. Không chọn COM, upload hay mở Serial.
- Preflight PASS trực tiếp: CLI1.5.1, Core esp32:esp32 3.3.7, profile Newmania V1 Flash8MB/QSPI PSRAM2MB, PSRAM=enabled, USB hardwareCDC/CDCOnBoot. Biến Arduino data/downloads chỉ trong process. Git ban đầu sạch, HEAD `642354fb551ca0f21ee2976271c92e11dd6ce740`; giữ nguyên công việc trước đó.
- Thêm native PSRAM/flash diagnostic an toàn. Compile **PASS/exit0**: program312,238 B, globals22,172 B; binary312,384 B đã tạo trong build-output ignored. Chưa đọc `psramFound()`/sizes từ thiết bị thật, không đánh dấu runtime PASS.
- Minimal upload/Blink47/Serial115200/PSRAM runtime/Digital input/ADC/PWM LED: **7/7 BLOCKED hardware**, không FAIL và không PASS. Sáu ví dụ trước đó có historical compile PASS; không compile lại hoặc claim hardware integration từ các record này.
- Giữ **SOFTWARE_ACCEPTED** và **HARDWARE_UNTESTED / PENDING_HARDWARE_VALIDATION**. Luồng CLI -> USB -> board, real upload/Serial/source-profile switching còn BLOCKED. Không sửa app, V2 hoặc PS4, không flash/commit/push.
- [Biên bản đầy đủ, từng test, command, blockers và Git commands](verification/NEWMANIA_V1_HARDWARE_SMOKE.md). Raw preflight/compile logs `docs/verification/newmania_v1_smoke_*.log` ignored.
- Kiểm tra tài liệu PASS: `git diff --check`, relative links; đúng5 file trong phạm vi, build/logs ignored, không binary tracked hoặc app/V2 diff.
- Tiếp tục khi có board: nối USB/rút tải, liệt kê cổng, xin xác nhận đúng COM và phê duyệt Minimal trước; không tự chuyển phase khác.

## Fast track Newmania Starter V1.0 — 2026-11-05

**SOFTWARE_ACCEPTED** cho registry ba profiles, GPIO validation/generation, safe examples và compile pipeline. **HARDWARE_UNTESTED** / **PENDING_HARDWARE_VALIDATION** giữ nguyên. V1 là board kiểm thử, V2 là board mục tiêu; native V2 không sửa. Baseline trước task `3106a9eee15e5057669249ad9f46eb83d22279d6`.

- Profile V1 N8R2: Flash8MB/QSPI PSRAM2MB, `PSRAM=enabled`, core3.3.7; V2 vẫn disabled, Generic giữ dự án cũ. Pinout đã đối chiếu DOCX người dùng cung cấp. USB CDC là cấu hình candidate chưa xác minh trên PCB.
- PASS `npm test`: 15/15, bao gồm native fakeGPIO/HTTP compile-upload guard, deterministic generation/round-trip, conflict và backwards compatibility. PASS `npm run build`: 61 modules, chunk warning >500kB.
- PASS sáu ví dụ V1 qua workspace -> generator -> HTTP -> CLI -> binary, script exit0. Không upload hoặc chọn COM. Program bytes từ311,846 đến322,174; raw log local `docs/verification/newmania_v1_build.log` ignored. [Báo cáo đầy đủ/build table/commit commands](verification/NEWMANIA_V1_FAST_TRACK.md).
- Chrome smoke PASS chọn V1/preview, block không rỗng qua đổi profile và reload, target FQBN trong device dialog và disabled state khi bridge unavailable. Chưa kiểm tra upload/Serial thật hoặc file-picker round-trip; test block đã dọn.
- Ví dụ minimal/Blink47/Serial/DI1/ADC1/PWM LED47 và [checklist hardware](boards/V1_HARDWARE_TEST.md) sẵn sàng. Motor/servo pins reserved, không tự enable. Không suy ra nguồn DC3–15V là an toàn cho motor kit3–6V; chưa có điều kiện servo power-ready/POWER_GOOD.
- Known issues: PS4 generator includes_/escaping chưa sửa; Blockly deprecation, bundle lớn và origin-port giới hạn giữ nguyên. Không có driver V2/PS4Bridge mới. Không commit/push. Dừng tại chuẩn bị V1 hardware testing.

Các record Phase 01/02.1/02.2 bên dưới giữ làm bằng chứng lịch sử, không thay thế kết quả fast track hiện tại.

## Phase 02.2 — BoardConfig & Safe Startup — PASS (2026-11-05)

**VERIFIED_BUILD / READY_FOR_PHASE02_3** cho acceptance phần mềm của [Issue #17](https://github.com/HiyoriVn/CodeLab/issues/17). **PENDING_HARDWARE_VALIDATION** vẫn giữ. Phase 02.3 chưa bắt đầu và không được tự chuyển tiếp.

- BoardConfig biểu diễn đúng 39 GPIO độc lập + các alias, motor6x2/servo6/encoder2, buses và strapping. Static assertions + host test đối chiếu map: PASS.
- SafeStartup: sáu servo Hi-Z/no pull; preload 12 motor + buzzer LOW trước output; không PWM, bus init hay enable API. Init/repeated call/failure paths test PASS, compile host exit 0, test exit 0. Trạng thái luôn không armed và servo DISABLED. `loop()` chỉ delay nhường scheduler.
- Arduino CLI 1.5.1, Core 3.3.7; compile FQBN `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled`: **PASS, exit 0**. Flash accounting 273,391 / 3,342,336 B (8%); RAM globals 21,428 / 327,680 B (6%), còn 306,252 B. BIN 273,536 B được tạo trong build-output ignored.
- Log local: `docs/verification/phase02_2_compile.log`; [báo cáo/commands/test results](verification/PHASE02_2_TEST_REPORT.md). `git diff --check` PASS, build artifacts ignored, không đổi `src/` hoặc `tools/`.
- Chưa đo GPIO/reset/USB-only trên board; không có khả năng xác nhận nguồn servo; không giả định POWER_GOOD. Firmware chỉ thiết lập trạng thái sau boot, không thay bảo vệ điện trước khi GPIO được init. PS4 CSV v1 và các lỗi generator đã ghi từ Phase 01 vẫn nguyên trạng.

## Phase 02.1 — Minimal firmware/toolchain preflight

**TOOLCHAIN_VERIFIED — PASS.** Arduino CLI 1.5.1, ESP32 Arduino Core 3.3.7, FQBN `esp32:esp32:esp32s3`; board details identify “ESP32S3 Dev Module”. Build options: `FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled`. Data directory set per-process to `C:\Users\Admin\AppData\Local\Arduino15`; downloads to `Arduino15\staging`. No system or IDE config changed.

**MINIMAL_BUILD_PASSED — PASS (exit 0).** Empty `setup()`/`loop()` sketch compiled. Program 271,423 / 3,342,336 bytes (8%); globals 21,420 / 327,680 bytes (6%), 306,260 bytes remaining. ELF and BIN emitted to `firmware/verification/minimal_build/build-output/`. First sandbox compile hit Windows `Illegal System DLL Relocation` launching Xtensa GCC; rerun with approved out-of-sandbox execution succeeded. Exact commands/output and failure evidence are in the log.

**READY_FOR_PHASE02_1: PASS. READY_FOR_PHASE02_2: PASS for starting the board-config/safe-startup implementation only. PENDING_HARDWARE_VALIDATION: YES.** This build selects a generic ESP32-S3 Dev Module profile with explicit 8 MB flash; it does not prove the board's USB/boot settings, physical PCB, resets, or power sequencing. Core 3.3.7 is installed; `core list` reports newer 3.3.12 available, but none was installed or selected. Bluepad32 Core 4.1.0 is not used for mainboard builds.

Servo output policy for Phase 02.2: **DISABLED by default**. Do not attach or emit servo pulses during init/USB-only operation. Enabling requires an explicit software command and an affirmative, independently verifiable power-stable interlock. No `POWER_GOOD` pin is documented; until a real condition is identified and verified, servo enable remains unavailable. This decision does not implement a servo driver.

PS4 transport remains CodeLab UART ASCII CSV v1 compatibility baseline: `connected,lx,ly,rx,ry,buttons\n`, default 115200 baud and stale threshold 250 ms. Phase 02.1 does not implement its parser, bridge, or application changes. Existing PS4 generator defects `includes_ / ps4_stdio` and helper escaping remain open; see [Phase 01 audit](PHASE01_AUDIT.md).

## Phase 01

| Task | Trạng thái | Bằng chứng |
|---|---|---|
| 1.1 Repository Inspection | Hoàn thành audit | Inventory/code review và host checks; có lỗi generator, không đánh dấu chức năng hoàn thiện |
| 1.2 Hardware Mapping | Hoàn thành đối chiếu tài liệu | H1/H2 đủ 4 trang; 39 GPIO + EN và đầu nối; hardware thực chưa kiểm tra |
| 1.3 Architecture Analysis | Hoàn thành thiết kế đề xuất | 7 lớp, 2 firmware độc lập; chưa implementation |
| 1.4 Module Gap Analysis | Hoàn thành | 18 module: 8 phần nguồn liên quan, 10 chưa có, 0 firmware module hoàn thiện |
| 1.5 Documentation | Hoàn thành | 7 đường dẫn bắt buộc + audit/library audit; đồng bộ docs cũ; kiểm tra liên kết/pinout/diff đạt |
| 1.6 Phase Planning | Hoàn thành kế hoạch | Phase 02-07 đều có objectives/scope/tasks/dependencies/deliverables/acceptance/risks |

## Các phase tiếp theo

| Phase | Trạng thái | Gate chính |
|---|---|---|
| 02.1 Minimal build preflight | Hoàn thành | CLI/core/FQBN, options và empty sketch verified; PENDING_HARDWARE_VALIDATION |
| 02.2 BoardConfig & Safe Startup | Hoàn thành software acceptance | Host tests + compile exit 0; PENDING_HARDWARE_VALIDATION |
| 02.3 | READY_FOR_PHASE02_3 (chưa bắt đầu) | Chỉ triển khai sau yêu cầu mới; hardware validation vẫn pending |
| 03 Sensor & Peripheral Drivers | Chưa bắt đầu | HAL, datasheet/tải, PWM resources, power-stable policy |
| 04 PS4 Bridge & UART Protocol | Chưa bắt đầu | Chip bridge Classic, nguồn/pins/package, protocol/bit/axis/freshness mapping |
| 05 Robot Control & Safety | Chưa bắt đầu | Drivers, cơ khí, safety/fault/re-arm requirements |
| 06 CodeLab Integration | Chưa bắt đầu | Mainboard API/protocol ổn định; fix generator và migration dự án |
| 07 Validation & Release | Chưa bắt đầu | Host/compile/UI + hardware records đầy đủ |

## Verification hiện tại

- Phase 02.1: CLI 1.5.1 + Core 3.3.7; compile PASS/exit 0 cho `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled`; size 271,423 B flash image accounting và 21,420 B globals. Chi tiết: `docs/verification/phase02_1_compile.log`.
- Hardware: **PENDING_HARDWARE_VALIDATION**. Không flash; chưa xác minh target trên PCB.
- PS4 generator: còn `includes_ / ps4_stdio`, raw character escaping; không liên quan kết quả minimal build.

- PASS: production web build (59 modules; chunk warning >500 kB), bridge JavaScript syntax, dependency inventory.
- FAIL được tái hiện: PS4 UART (hai bộ pin) và I2C generation lỗi `includes_`/`ps4_stdio`; helper còn có LF/CR/NUL escaping defect.
- Đã đọc/đối chiếu: hai PDF, đủ 4 trang; nguồn/hashes và pin mapping trong hardware docs; L1 PS4Bluepad32 1.0.1 trong ZIP ngoài repo.
- Static risks: default UART16/17 xung đột servo; motor block 3 chân không hợp TMI8260; thiếu boot/safety gate; mask/scale L1 khác legacy; không lock/toolchain firmware.
- Chưa kiểm tra: browser mới, Arduino/PlatformIO compile, PS4 trên chip, serial/hardware. Arduino CLI/pio không tìm trên PATH. Không flash, không kích hoạt tải.
- PASS kiểm tra tài liệu: 16 Markdown mới/sửa, 61 liên kết tương đối không có đích thiếu; đủ 7 đường dẫn bắt buộc, 18 module và 7 mục yêu cầu cho từng Phase 02-07.
- PASS pinout: 39 dòng GPIO, không trùng/thiếu/thừa; script trích 39 cặp signal/GPIO từ H1 và so với PINOUT cho kết quả khớp toàn bộ. EN và chân nguồn/alias được đối chiếu trực quan riêng.
- PASS `git diff --check`; diff ở `src/`, `tools/`, `package.json`, `vite.config.js`, `index.html` rỗng. Chỉ 8 tài liệu được tạo và 8 tài liệu hiện hữu được sửa; ảnh render tạm đã dọn, `dist/` là build output ignored. Không commit/push.

## Readiness và dữ liệu cần bổ sung

**Phase 01 hoàn thành trong phạm vi audit/tài liệu; dừng tại đây.** Đủ nền tảng để review Phase 02, chưa cho phép tự chuyển phase. Mainboard HAL có thể được triển khai sau khi có yêu cầu mới và chốt toolchain/boot/power policy; bridge chip/nguồn/pins vẫn là gate Phase 04. Câu hỏi chi tiết và rủi ro F1-F13 ở [audit](PHASE01_AUDIT.md).
