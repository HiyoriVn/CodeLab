# Progress - hardware/firmware roadmap

Cập nhật 2026-11-04 (Asia/Saigon). Baseline local: `codex/integrate-bach-ui` @ `f3a839825ca2e83fcb82337cbfe4f8dd2afc3efc`. Nhánh chưa được audit này commit/push. [Báo cáo đầy đủ](PHASE01_AUDIT.md), [kế hoạch](IMPLEMENTATION_PLAN.md).

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
| 02 Firmware Core & HAL | Chưa bắt đầu | Yêu cầu triển khai mới, pinned toolchain/profile, boot/output inhibit design |
| 03 Sensor & Peripheral Drivers | Chưa bắt đầu | HAL, datasheet/tải, PWM resources, power-stable policy |
| 04 PS4 Bridge & UART Protocol | Chưa bắt đầu | Chip bridge Classic, nguồn/pins/package, protocol/bit/axis/freshness mapping |
| 05 Robot Control & Safety | Chưa bắt đầu | Drivers, cơ khí, safety/fault/re-arm requirements |
| 06 CodeLab Integration | Chưa bắt đầu | Mainboard API/protocol ổn định; fix generator và migration dự án |
| 07 Validation & Release | Chưa bắt đầu | Host/compile/UI + hardware records đầy đủ |

## Verification hiện tại

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
