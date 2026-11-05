# Kế hoạch Phase 01-07: mainboard, PS4 bridge và CodeLab

Ngày 2026-11-04. Đây là **kế hoạch**, không phải công việc được tự động cho phép thực hiện. Đây là baseline kế hoạch Phase 01; trạng thái triển khai từng phần Phase 02 và fast track hiện tại được ghi ở PROGRESS.md. Dãy số này khác [roadmap web lịch sử](ROADMAP.md). Baseline và blockers xem [PROGRESS.md](PROGRESS.md), [audit](PHASE01_AUDIT.md).

## Fast track Newmania Starter V1.0 — 2026-11-05

Yêu cầu mới cho phép tích hợp nhiều board để chuẩn bị board kiểm thử V1. V2 vẫn là board mục tiêu; native V2 BoardConfig/SafeStartup giữ nguyên. Phạm vi: registry/profile validation, lựa chọn board trong project, generated basic digital/ADC/PWM LED47 + serial, six compile-only examples, HTTP compile/upload target binding và checklist hardware. Không mở rộng sang MotorDriver V2 hoặc PS4Bridge. SOFTWARE_ACCEPTED chỉ áp dụng phạm vi đã test; HARDWARE_UNTESTED vẫn giữ.

Deliverables và acceptance: [board profiles](boards/BOARD_PROFILES.md), [hướng dẫn/checklist V1](boards/V1_HARDWARE_TEST.md), [báo cáo build/test/commit-ready](verification/NEWMANIA_V1_FAST_TRACK.md). Core pin3.3.7; V1 N8R2 dùng QSPI PSRAM enabled, V2 N8 giữ disabled. Giữ format project version1 với optional boardId, thiếu -> Generic; không sửa pin ngầm. Hoàn tất ở chuẩn bị hardware testing, không tự chạy upload hoặc phase tiếp theo.

## Phase 01 - Repository Audit & Hardware Mapping

- **Objectives:** xác định nguồn thật, pinout và khoảng trống trước firmware.
- **Scope:** đọc repository, H1/H2 và L1; architecture/module gaps; tài liệu; kiểm tra phần mềm không truy cập board.
- **Tasks:** Task 1.1-1.6 theo yêu cầu người dùng; phân biệt nguồn, giả định và quan sát; giữ code hiện có.
- **Dependencies:** repository local, hai PDF, ZIP được cung cấp.
- **Deliverables:** AGENTS, hardware/pinout, architecture/modules, library audit, kế hoạch, báo cáo và progress.
- **Acceptance criteria:** đủ GPIO/đầu nối H1; nguồn mỗi thông số; đủ 18 module; 6 phase tiếp theo có mục tiêu/phạm vi/nhiệm vụ/phụ thuộc/đầu ra/acceptance/risks; không sửa source, không commit/push/flash.
- **Risks:** tài liệu board không thay thế đo phần cứng; PDF/ZIP nằm ngoài git; local branch không đồng nghĩa remote main.

## Phase 02 - Firmware Core & HAL

- **Objectives:** nền firmware mainboard có thể build và kiểm tra không tải, với boot an toàn ngay từ đầu.
- **Scope:** BoardConfig V2/N8, core lifecycle, HAL, bus/time abstraction, output inhibit, diagnostics/status CLI tối thiểu. Chưa điều khiển robot, chưa PS4 pairing.
- **Tasks:** chốt core/FQBN/flash/partition/USB; chọn build system và pin versions; lập resource budget PWM/PCNT/timer; tạo target mainboard và interfaces/fakes; khai báo đúng pinout/alias; initialization tất cả motor/buzzer LOW; servo disable; cấu hình USB/UART0 debug và UART1 reserved; ghi lỗi init và board/build IDs.
- **Dependencies:** H1/H2, đối chiếu module thật và schematic phần reset/nguồn; quyết định toolchain. Bridge chip chưa biết không chặn HAL mainboard nhưng không được tạo target bridge giả.
- **Deliverables:** mainboard build config, HAL/BoardConfig/core, host tests, build log, initialization design và test record. Không hứa firmware bridge ở phase này.
- **Acceptance criteria:** clean build reproducible bằng toolchain pin; map khớp 39 GPIO + EN và alias; reject sử dụng USB/bus/strapping trái policy; fake I/O xác minh mọi motor/buzzer LOW và không servo pulse trước readiness; lỗi init giữ disarmed; không auto-arm. Nếu kiểm tra trên board được giao: ghi module, toolchain, wiring, waveform reset/boot; hardware acceptance vẫn pending nếu thiếu board/đo.
- **Risks:** generic S3 profile sai flash/USB; GPIO26 bị hiểu sai từ N4R2; nguồn/reset chưa đo; PWM motor/servo cạnh tranh tài nguyên. Không giả định có power-good; giữ servo disabled nếu chưa chứng minh điều kiện nguồn.

## Phase 03 - Sensor & Peripheral Drivers

- **Objectives:** driver từng ngoại vi có interface, error state và kiểm tra độc lập.
- **Scope:** TMI8260 x6, servo x6, encoder x2, QMI8658B, buzzer, I2C/SPI/UART plumbing; chưa kinematics hoặc PS4 robot control.
- **Tasks:** lấy datasheet register/timing phù hợp; TMI truth table và PWM/reversal policy; servo pulse ranges/calibration và power gate; encoder count/filter/overflow; IMU identity/config/units/FIFO hoặc polling; I2C timeout/recovery/shared ownership; kiểm tra bus không gắn thiết bị; buzzer nonblocking.
- **Dependencies:** Phase 02; motor/servo/encoder specs; dữ liệu nguồn ổn định; datasheet QMI8658B Rev D/TMI8260 v1.7; resource allocation được chốt.
- **Deliverables:** drivers, host fault tests, ví dụ compile-only và quy trình bench có thể tái lập; hardware records khi được thực hiện riêng.
- **Acceptance criteria:** test coast/brake/direction đúng H1, clamp/error và không chuyển động lúc init; servo không phát trước gate; encoder chiều/count/overflow đúng test vectors; IMU đúng identity/units và mất bus báo lỗi/stale; bus dùng chung không init đè nhau. Ghi kết quả thật cho từng kênh khi bench được cho phép; không đánh dấu 6 kênh pass từ một kênh thử.
- **Risks:** không đủ PWM resources, sai xung servo, nhiễu encoder/I2C, chưa biết CPR/rail/tải. Chưa tự chọn thông số động chỉ để làm demo.

## Phase 04 - ESP32 PS4 Bridge & UART Protocol

- **Objectives:** đưa trạng thái PS4 có freshness đáng tin từ bridge về mainboard qua UART1.
- **Scope:** firmware bridge độc lập; UART transport/parser mainboard; protocol version và conversion legacy. Không motor control trực tiếp trên bridge.
- **Tasks:** nhận diện chip/nguồn/pins/LED bridge; chỉ chọn Classic nếu chip hỗ trợ; pin Bluepad32/core và L1; compile example trước tích hợp; đặc tả byte order/ranges/baud/cadence/framing/version/length/checksum/sequence/timeout; ánh xạ bit/axis/trigger; tách log debug; snapshot/heartbeat phân biệt kết nối và report freshness; xử lý reset/NVS/reconnect; xây golden vectors và parser fault tests.
- **Dependencies:** Phase 02 HAL; chip hỗ trợ PS4 BR/EDR; 3.3 V logic/cross-wire/common GND; nguồn bridge xác nhận; package/version compile được. Mặc định 115200 và 250 ms legacy chỉ là điểm tham khảo, không là thông số phần cứng đã đo.
- **Deliverables:** hai build target/config độc lập, protocol spec có phiên bản, serializer/parser, conversion matrix, tests và link/PS4 test records. Không lồng thư viện PS4 vào mainboard S3.
- **Acceptance criteria:** build hai firmware theo exact targets; mọi nút/trục và trung tính đúng vectors; reject partial/overlong/malformed/out-of-range/version/CRC lỗi; duplicate/out-of-order/reset sequence được xử lý theo spec; stale input không được heartbeat làm mới; mất PS4 hoặc UART không giữ lệnh có hiệu lực; reconnect không auto-arm. Hardware pass cần controller/bridge/model/firmware/wiring/captured frames và thời gian fault đo được.
- **Risks:** chip không Classic, package Arduino/PlatformIO không tương thích, bitmask khác legacy, lỗi generator PS4, callback MAC không là strict model filter, log làm nhiễu link. Deadline mới phải được lý giải từ cadence và safety requirement, không tự lấy số tùy ý.

## Phase 05 - Robot Control & Safety

- **Objectives:** robot nhận lệnh có kiểm soát, phát hiện lỗi và đưa đầu ra về trạng thái được đánh giá phù hợp cơ cấu.
- **Scope:** CommandRouter, RobotController, DriveController, MotionControl, SafetyManager hoàn chỉnh, SerialCLI có validation.
- **Tasks:** xác định loại chassis/motor associations/encoder CPR/gearing; modes và quyền điều khiển; kinematics, PID khi cần, limits/ramp/reversal; boot/disarmed/armed/fault state machine; watchdog/scheduling; link/sensor freshness; nguồn readiness/brownout policy trong giới hạn phần cứng thực có; explicit stop và re-arm; diagnostics/fault counters.
- **Dependencies:** Phase 03 drivers, Phase 04 controller state, thông số cơ khí/tải và safety policy do chủ dự án chốt. Không suy ra có E-stop hay cảm biến điện áp trên board.
- **Deliverables:** control/safety modules, fake-clock scenarios, fault matrix, calibration records và bench plan tách nguồn/tải.
- **Acceptance criteria:** mọi nguồn lệnh qua safety gate; khởi động/reconnect không chuyển động; timeout/link loss/sensor invalid/scheduler overrun kích hoạt chính sách xác định; re-arm tường minh; bound/clamp/stop được kiểm tra; lựa chọn coast/brake/servo hold-release có lý do theo tải. Hardware validation phải ghi độ trễ fault-to-output thực đo và giới hạn chấp nhận đã thống nhất trước thử.
- **Risks:** cơ cấu không biết, drop load khi thả servo, phanh gây dòng lớn, blocking loop làm trễ safety, thiếu phản hồi nguồn. Không diễn giải neutral input là dừng robot nếu phần điều khiển chưa áp dụng nó.

## Phase 06 - CodeLab Integration

- **Objectives:** giữ editor đang dùng và sinh firmware đúng board/API/safety.
- **Scope:** board profile, Arduino generator gọi API, logical motor/servo/sensor/controller blocks, protocol compatibility, project migration, compile/upload UX.
- **Tasks:** sửa lỗi `includes_` và escaping helper có regression tests; chuyển TMI8260 từ mô hình 3 chân sang API 2 input/kênh qua migration tường minh; thay default UART16/17 theo board profile mà không sửa ngầm file cũ; bảo vệ I2C/USB/strapping; kiểm soát chương trình blocking; golden fixtures/source mapping; gắn build ID với code/target; điều phối Web Serial và CLI upload; hiển thị đúng target và yêu cầu upload riêng.
- **Dependencies:** firmware API ổn định Phase 02-05; protocol chốt; serialized workspace version/migration plan; exact compiler.
- **Deliverables:** tích hợp web/firmware, fixtures, migration docs, examples và troubleshooting thực sự có trong repo, compile tests, UI verification.
- **Acceptance criteria:** dự án version 1 giữ dữ liệu; không mất block khi unsupported; generation deterministic trên bộ fixtures; generated sketches compile với pinned mainboard toolchain; PS4 bit/axis đúng protocol; không bypass safety; warnings chặn compile phù hợp; artifact upload khớp code/target đã duyệt, explicit user action; browser persistence/import/export và port lifecycle được kiểm tra. Không tuyên bố Scratch integration nếu chưa có yêu cầu/implementation riêng.
- **Risks:** breaking workspace, duplicate block templates, stale build ID, serial port bị chiếm, bundle lớn, thay core làm API PWM khác. Giữ templates không active tới khi có review compatibility.

## Phase 07 - Validation & Release

- **Objectives:** chứng minh release có thể tái tạo và vận hành đúng phạm vi hardware/software hỗ trợ.
- **Scope:** integration, fault injection, hardware matrix, long-run reliability, browser/OS/USB checks, release docs/artifacts/licenses.
- **Tasks:** chạy toàn bộ host/compile/UI tests; test reset/USB-only/power sequence và mọi motor/servo/encoder/IMU; PS4 pairing/reconnect/out-of-range/UART faults; đo jitter/latency/timeouts/nguồn/nhiệt với tải đã xác định; pin toolchains/dependencies, document known limits và rollback; rà dependency/license provenance.
- **Dependencies:** Phase 02-06 đáp ứng acceptance; board/controller/tải thật, dụng cụ đo và quy trình thử được giao rõ ràng; supported matrix được chốt.
- **Deliverables:** release binaries/source/build manifest/checksums, logs/waveforms, hardware acceptance matrix, setup/examples/troubleshooting, release notes và known issues.
- **Acceptance criteria:** tất cả kiểm tra bắt buộc có kết quả thật; từng record ghi board/module revision, wiring/power/load, toolchain/firmware/commit, steps và observed result; không lỗi P0 còn mở; reproducible build và negative/fault tests đạt; tác động đầu ra chỉ sau thao tác explicit; chỉ quảng bá tổ hợp đã kiểm chứng.
- **Risks:** giả định dòng định mức là dòng board liên tục, chưa đủ thiết bị đo, Bluetooth/USB khác theo host, dependency drift do không lock, thiếu review phân phối. Không phát hành “hardware verified” khi chỉ chạy mô phỏng/build.

## Điểm dừng

Audit Phase 01 không cho phép tự chạy bất kỳ phase sau. Các phép flash/bench nói ở trên là tiêu chí tương lai, không phải hành động đã thực hiện hoặc được mặc định cho phép trong chat này.
