# Phase 01 report - Repository Audit & Hardware Mapping

Ngày 2026-11-04 (Asia/Saigon). Phạm vi local checkout trước chỉnh sửa: branch `codex/integrate-bach-ui`, commit `f3a839825ca2e83fcb82337cbfe4f8dd2afc3efc`, worktree sạch. Origin: `https://github.com/HiyoriVn/CodeLab.git`. GitHub connector xác nhận repo public, default branch `main`; không fetch/merge/sync, không khẳng định local HEAD bằng remote main mới nhất. Những kết luận code trong báo cáo áp dụng commit local này.

## 1. Repository Audit Summary

### Cấu trúc và build

| Vị trí | Vai trò thực tế |
|---|---|
| `src/App.jsx`, `src/ui/`, `src/styles.css` | React UI, local projects, theme/menu, dialogs |
| `src/components/BlocklyWorkspace.jsx` | Blockly toolbox, serialization, workspace lifecycle |
| `src/blocks/robotics.js`, `controller.js` | Block GPIO/ADC/PWM/delay/H-bridge và PS4 contract |
| `src/blocks/renderer.js`, `theme.js` | Renderer/theme custom |
| `src/blocks/template/` | 14 reference files; không đăng ký runtime, có README về xung đột |
| `src/generators/arduino.js` | JavaScript sinh Arduino C++; helper PS4 nằm trong template string |
| `src/components/DevicePanel.jsx`, `SerialMonitor.jsx` | Compile/upload UI, Web Serial terminal |
| `tools/arduino-bridge.mjs` | Node loopback HTTP -> Arduino CLI; không phải firmware UART bridge |
| `package.json`, `vite.config.js`, `index.html` | npm/Vite build, proxy `/api` tới local bridge |
| `public/images/`, `docs/`, root Markdown | UI images, roadmap/setup/testing và hướng dẫn |

Ngôn ngữ: JavaScript/JSX, CSS, HTML, Markdown; Arduino C++ chỉ ở output template. Không có `.ino/.cpp/.h` firmware trong tracked repository trước audit, không PlatformIO/CMake/ESP-IDF project, không firmware binary/release hoặc test suite/CI workflow được tìm thấy. Không có `test`/`lint` scripts; scripts thực tế là `dev`, `build`, `preview`, `bridge`. ZIP L1 ngoài repo có C++ và một ví dụ `.ino`, không được tính là firmware CodeLab.

Declared dependencies: React/React DOM `^19.1.1`, Blockly `^12.3.0`; dev dependencies Vite `^7.1.2`, React plugin `^5.0.0`. Installed qua `npm ls --depth=0`: React/React DOM 19.3.1, Blockly 12.5.1, Vite 7.3.7, plugin 5.2.0. `package-lock.json` bị ignore, không có lockfile tracked; build tái tạo chưa được bảo đảm. Audit dùng dependencies sẵn có, không cài thêm.

### Phân loại theo bằng chứng

| Hạng mục | Phân loại | Bằng chứng / giới hạn |
|---|---|---|
| Web bundle | Đã triển khai; bước production build đã xác minh | `npm run build` pass; không đồng nghĩa app/hardware hoàn thiện |
| Editor/projects/import-export/theme | Đã triển khai một phần acceptance | Source có; smoke UI lịch sử trong TESTING; audit này không chạy browser lại |
| Arduino generator generic | Một phần; cần refactor | Empty/motor/GPIO sinh output; chưa compile C++; unsupported blocks có warnings |
| PS4 generator/adapter | Một phần, lỗi đã tái hiện | UART/I2C đều trả lỗi `ps4_stdio`; xem V4/F1 |
| Mainboard HAL/drivers/control/safety | Chưa có | Không firmware target hoặc board-specific driver trong repo |
| External PS4 library | Source ngoài repo, chưa tích hợp | L1 1.0.1, chưa compile/pair/stream UART |
| CodeLab/Scratch | Blockly -> Arduino có một phần | Không Scratch VM/runtime/extension, `.sb3` hoặc Scratch bridge |
| Local compile/upload | Một phần | Source có explicit confirmation/target/ports; CLI chưa có trên PATH, hardware chưa kiểm tra |
| Templates | Có nguy cơ xung đột nếu activate | Có type/input names chồng runtime; README yêu cầu review, hiện không imported |
| Tests/examples/docs | Một phần, tài liệu cũ có lệch trạng thái | TESTING là checklist + record cũ; không tracked suite, không thư mục examples; EXAMPLES/TROUBLESHOOTING được nhắc nhưng không tồn tại |

**Đã hoàn thiện:** không có end-to-end firmware module hoặc hardware feature đủ bằng chứng để xếp hoàn thiện. Build web là một kiểm tra đã pass, không phải nhãn hoàn thiện sản phẩm.

## 2. Hardware Mapping Summary

Đã đọc H1 3 trang và H2 1 trang ở Documents (không ở workspace). Trích đủ 39 GPIO, EN và các chân nguồn/đầu nối được mô tả; xem [PINOUT](hardware/PINOUT.md), [HARDWARE](hardware/HARDWARE.md) để có nguồn trang/section/hash.

- Motors M1..M6: `(42,41)`, `(40,39)`, `(38,37)`, `(36,35)`, `(48,34)`, `(33,47)` cho IN1/IN2; tất cả LOW lúc init.
- Servo 1..6: `14,15,16,17,18,21`; không phát xung trước nguồn ổn định; USB-only LOW/Hi-Z.
- Encoders: `1/2`, `4/5`; nguồn 3.3 V. I2C SDA8/SCL9, QMI8658B `0x6A`, hai header chung bus.
- UART0 TX43/RX44; UART1 TX6/RX7. UART1 header 1 GND, 2 +5V_Core, 3 TX, 4 RX; đấu chéo với bridge, không mặc định nối chân 2 sang nguồn bridge.
- SPI SCK12/MOSI11/MISO13/CS10; USB D-19/D+20 dành native. Buzzer26 LOW init. BOOT0, RESET EN; GPIO0/3/45/46 strapping, H1 xác nhận 45/46 kéo LOW.
- Mở rộng alias UART1 6/7 và SPI CS10; không được tính thành bus/pin độc lập. Điện áp nguồn connector 5 V không thay đổi logic 3.3 V.

Không có xung đột trực tiếp giữa hai PDF trong dữ liệu đã trích. Chưa xác minh against schematic đầy đủ/board vật lý. Tham số không có nguồn (bridge pins, servo timing, power-good, IMU rail, CPR...) giữ trạng thái chưa rõ.

## 3. Existing vs Missing Modules

[MODULES.md](architecture/MODULES.md) có đủ 18 module và 6 cột yêu cầu: 8 có nguồn liên quan một phần, 10 chưa có implementation trong repository, 0 firmware module hoàn thiện. Nền tảng có thể tái sử dụng là UI/Blockly/generator/host compile service; chưa có core HAL/robot firmware. L1 chỉ bổ sung ứng viên PS4Controller phía bridge, không giải quyết UARTProtocol hoặc SafetyManager.

## 4. Proposed Firmware Architecture

[Kiến trúc mới](architecture/ARCHITECTURE.md) tách hai binary: mainboard S3 điều khiển ngoại vi/robot/safety; ESP32 bridge nhận PS4 và gửi trạng thái. Bảy lớp: HAL, Peripheral Drivers, Communication, Robot Control, Safety Manager, CodeLab Integration, PS4 Bridge Firmware. Interfaces cho phép host tests không cần hardware. Generated program, CLI và PS4 đều phải qua cùng output safety gate. Kiến trúc này mới là đề xuất; không có firmware được tạo trong Phase 01.

## 5. Risk & Dependency Analysis

| ID / mức | Phát hiện và bằng chứng | Hệ quả / xử lý đề xuất |
|---|---|---|
| F1 / P0 | `ArduinoGenerator.init` không tạo `includes_`; `configureController` và controller expressions gán `gen.includes_['ps4_stdio']`. Headless UART/I2C tái hiện TypeError | PS4 code không sinh được với installed Blockly; Phase 06 sửa + fixtures trước tuyên bố hỗ trợ |
| F2 / P0 | Đánh giá nguyên template `PS4_HELPER` thấy 2 NUL và LF/CR thực trong character literals do JS xử lý `\n`, `\r`, `\0` | Lỗi C++ tiềm ẩn sau F1; chưa compiler-test. Sửa escaping và compile golden sketches ở Phase 06 |
| F3 / P0 | Toolbox UART mặc định RX16/TX17 (`BlocklyWorkspace.jsx`), H1 map servo3/4 ở 16/17 | Xung đột board; Phase 06 profile/migration dùng RX7/TX6. Không sửa source trong audit |
| F4 / P0 | H-bridge block yêu cầu 3 GPIO khác nhau; TMI H1 chỉ IN1/IN2. Headless mẫu speed=0 vẫn sinh IN1 HIGH trong loop và không ghi motor LOW trong setup | Không dùng generic motor output trực tiếp cho board; Phase 02 safe startup, 03 TMI driver, 06 block/API migration |
| F5 / P0 | Helper chỉ trả neutral từ accessors sau 250 ms; polling ở loop preamble; `delay`/while có thể chặn update; chưa output gate | Neutral PS4 không đảm bảo dừng motor. Phase 02 inhibit, Phase 05 scheduling/fault policy; không dùng timeout hiện tại làm safety certification |
| F6 / P0 | `sscanf` kiểm tra 6 fields nhưng không giới hạn connected=0/1; axes bị clamp; không version/CRC/sequence. I2C đủ byte được coi fresh dù dữ liệu có thể cũ | Static review, chưa chạy parser C++. Phase 04 strict contract/fault tests, Phase 06 migration; tài liệu legacy không được khẳng định parser đã validate ranges |
| F7 / P0 | L1 axes +/-100 và mask khác CodeLab int16/mask; không UART publisher; chip bridge chưa xác nhận | Mapping sai nút/biên độ hoặc không kết nối Classic; chip/package/power và converter là gate Phase 04 |
| F8 / P1 | Generic warnings GPIO26-37 chặn compile khi có warnings; buzzer26 tái hiện warning. H1 dùng 26 và 33-37 trên N8 | Cần board-specific validation, không đổi sơ đồ để né warning. Đối chiếu N8/N4R2 ở HARDWARE |
| F9 / P1 | `DevicePanel` giữ buildId sau khi code props đổi, không invalidation effect; backend lưu artifact theo ID | Rủi ro upload artifact cũ so với preview; static review, chưa UI tái hiện. Phase 06 bind code/target/build và xác nhận rõ |
| F10 / P1 | Web Serial và CLI là hai chủ truy cập cổng; serial panel được giữ mounted khi hidden | Có nguy cơ tranh chấp port lúc upload; Phase 06 lifecycle test/handoff. Không kiểm chứng phần cứng trong audit |
| F11 / P1 | Origin allowlist local bridge chỉ port 5173/4173/8787 dù Vite có thể chọn port khác hoặc bridge có env port | Rủi ro HTTP 403 ở cấu hình khác (smoke cũ dùng 5174); static review, không khẳng định lần chạy cũ gặp 403. Phase 06 config tests |
| F12 / P1 | Chưa pin toolchain/dependencies, không lock tracked, không test suite; Arduino CLI/pio không tìm trên PATH | Build web pass không chứng minh generated sketch/firmware compile; Phase 02/04/06 thiết lập reproducible builds |
| F13 / P0 hardware | Tải/nguồn bridge/servo power readiness/reset levels chưa kiểm tra; spec ghi định mức IC, không đo board | Không cấp tải/flash trong audit. Phase 02-07 cần hồ sơ schematic/board/power/wiring và measured results |

Dependency về giấy phép/provenance L1 được ghi trong [library audit](architecture/PS4_LIBRARY_AUDIT.md). Không thêm npm hay firmware dependency.

## 6. Files Created/Modified

Tạo mới:

- `docs/hardware/HARDWARE.md`, `docs/hardware/PINOUT.md`.
- `docs/architecture/ARCHITECTURE.md`, `docs/architecture/MODULES.md`, `docs/architecture/PS4_LIBRARY_AUDIT.md`.
- `docs/IMPLEMENTATION_PLAN.md`, `docs/PROGRESS.md`, `docs/PHASE01_AUDIT.md`.

Cập nhật tài liệu hiện hữu: `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/PS4-RECEIVER.md`, `docs/ROADMAP.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md` để đồng bộ board/transport/status và liên kết audit. Giữ các hướng dẫn còn phù hợp và historical verification. Không sửa `src/`, `tools/`, package/build config; không commit/push. Build chỉ tạo output ignored `dist/`; ảnh PDF tạm đã được dọn sau đối chiếu.

## 7. Verification Results

Môi trường Windows, Node v26.12.1, npm 11.20.0. Ngày 2026-11-04, local HEAD ở đầu báo cáo. Các check một lần phục vụ audit, không phải test suite mới.

| ID | Kiểm tra thực hiện | Kết quả / giới hạn |
|---|---|---|
| V1 | `git status --short`, `git ls-files`, `rg --files`, đọc code/docs/package/ZIP | Worktree ban đầu sạch; inventory và evidence như trên |
| V2 | Extract PDF bằng PyMuPDF; `pdftoppm -scale-to 1400 -png`; xem cả 4 trang; SHA-256 | Đã đọc đủ pinout và chú thích. Lần extract đầu lỗi stdout cp932; chạy lại UTF-8 thành công, không bỏ trang |
| V3 | `npm run build` trên dependencies có sẵn | PASS: Vite 7.3.7, 59 modules, 7.53 s; JS 1,032.85 kB minified, warning chunk >500 kB. Không browser/firmware test |
| V4 | Node headless Blockly: empty, UART RX7/TX6, UART RX16/TX17, I2C8/9 address48, generic motor42/41/PWM48 speed0, GPIO26; mỗi workspace generate hai lần | Empty/motor/GPIO sinh output lặp lại giống nhau; 3 case PS4 trả cùng TypeError `ps4_stdio`. Đây là phát hiện FAIL chức năng, không đánh dấu test pass vì process exit 0. Mẫu motor chỉ tạo text, không chạy lên board |
| V5 | Node `vm.runInNewContext` đánh giá riêng hằng PS4_HELPER đọc từ source | 2 NUL; character literal chứa LF/CR thực. Chưa compile helper C++ |
| V6 | `node --check tools/arduino-bridge.mjs`; `npm ls --depth=0` | PASS cú pháp bridge và inventory installed dependencies; không chạy HTTP/device workflow |
| V7 | `Get-Command arduino-cli`, `Get-Command pio` | Không tìm thấy trên PATH; không kết luận chúng không tồn tại ở bất kỳ vị trí nào. Không compile sketch/ZIP |
| V8 | `git diff --check`; kiểm tra Markdown links, số dòng GPIO và source diff sau cập nhật | Kết quả chốt tại [PROGRESS.md](PROGRESS.md) |

V4 tái hiện bằng Node ESM: import `blockly`, `blockly/blocks`, runtime block modules và `generateArduino`; tạo `new Blockly.Workspace()`, `newBlock(type)`, nối `math_number` vào input tương ứng, gọi generator hai lần. V5 lấy đoạn từ `const PS4_HELPER =` đến trước `function variableTypeOf`, đánh giá hằng trong VM, đếm ký tự code 0 và kiểm tra literal chứa LF/CR. Không sửa hay patch generator để chạy check.

Blockly báo deprecation `getAllVariables` ở V4. Không có browser smoke mới, Arduino compile, upload, serial I/O, PS4 pairing, motor/servo hoặc hardware test. Record UI trước đây trong TESTING giữ nguyên và không dùng thay hardware acceptance.

## 8. Open Questions

1. Chip/board ESP32 rời chính xác, revision, nguồn input, UART/LED/debug pins và controller PS4 cụ thể?
2. Có schematic/BOM P1 30/10/2026 và xác nhận module N8 trên board thực để kiểm tra nguồn/reset/pull-up không?
3. Chọn exact Arduino core/FQBN/flash/partition/USB configuration cho mainboard; Bluepad32/core package cho bridge; yêu cầu PlatformIO hay Arduino CLI?
4. Motor/servo/encoder models, dòng tải, pulse range, CPR/gearing, motor-encoder association và loại chassis?
5. Servo power-stable được xác nhận bằng cơ chế nào; chính sách coast/brake/hold khi fault, explicit arm/stop và độ trễ tối đa mong muốn?
6. Protocol có cần analog triggers/touchpad/telemetry ngược; baud/cadence/sequence/checksum/version và migration legacy được chọn thế nào?
7. Supported host OS/browser và thiết bị/dụng cụ đo cho acceptance cuối cùng?

Các câu hỏi là dependencies được theo dõi, không phải lý do dừng phần audit đã có đủ dữ liệu. Không tự trả lời bằng pin/timing/chip giả định.

## 9. Phase 02 Readiness

**Sẵn sàng để review/chốt phạm vi Phase 02, chưa sẵn sàng để tuyên bố firmware hoặc hardware vận hành.** Pinout tài liệu, architecture, gap matrix và kế hoạch đã có. Trước implementation cần yêu cầu mới cho Phase 02, chốt toolchain/profile và safe initialization/power-readiness design. Việc chưa biết chip bridge không chặn thiết kế HAL mainboard nhưng chặn chọn target PS4/Classic ở Phase 04.

Phase 01 kết thúc ở tài liệu và kiểm tra trên host. Không bắt đầu Phase 02.
