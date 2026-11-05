# Progress - hardware/firmware roadmap

Cập nhật 2026-11-05 (Asia/Saigon). Baseline code trước preflight: `codex/integrate-bach-ui` @ `3a81e54aca414524bb949f3b24af6eb3b2e6b88f`. [Báo cáo Phase 01](PHASE01_AUDIT.md), [kế hoạch](IMPLEMENTATION_PLAN.md), [log build Phase 02.1](verification/phase02_1_compile.log).

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
| 02.2 BoardConfig & Safe Startup | READY_FOR_PHASE02_2 (chưa bắt đầu) | Profile build baseline và servo DISABLED policy chốt; triển khai chỉ sau chỉ thị |
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
