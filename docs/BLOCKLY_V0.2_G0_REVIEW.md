# Rà soát G0 — Blockly Product Spec V0.2

> **Ngày rà soát ban đầu:** 10/11/2026 · **Cập nhật G0.1:** 10/11/2026  
> **Issue:** #28 · **Spec:** `docs/BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.2.md` (branch `docs/blockly-product-spec`)  
> **Đối chiếu:** `main` @ `2a0705d`; tham khảo thêm nhánh `codex/integrate-bach-ui` (fast100/Devices).  
> **Phạm vi:** Tài liệu đặc tả và hợp đồng interface. Không sửa source code phần mềm, không đổi firmware, không upload phần cứng.

---

## 0. Kết luận hiện tại: **G0_READY_FOR_APPROVAL (G0.2 blockers resolved; owner approval pending)**

- **B1–B4 được xử lý trong bản G0.2**: consistent callback ABI and wait state, atomic ownership/STOP priority, real endpoints and trusted upload policy, full schema and fixtures. Bridge and production code remain unchanged.
- Mọi interface dùng chung giữa Scheduler, Generator, Devices và Firmware đã được đặc tả chính xác inputs/outputs, quyền sở hữu (ownership) và hành vi khi có lỗi.
- **Để chuyển sang `G0_PASS` và bắt đầu triển khai G1:** Chủ dự án (Project Owner) cần xác nhận phê duyệt các quyết định D1–D11 trong Issue #28 (xem danh sách tại §5 bên dưới). Agent không tự ý phê duyệt thay người dùng.

---

## 1. Phân loại quyết định

### 1.1. Đã giải quyết & thống nhất trong G0.1

| Chủ đề | Mục spec | Quyết định đã chốt trong đặc tả G0.1 |
|---|---|---|
| Bốn trạng thái INIT/READY/RUN/FAULT | §2.1–2.2 | `INIT -> READY -> RUN -> FAULT`. FAULT không chặn compile/nạp |
| Kiến trúc Safety & Heartbeat (B1) | §2.4, §12.1 | Scheduler cooperative phát heartbeat (≤50 ms); Safety Monitor độc lập nhận và giám sát (timeout >250 ms -> FAULT `V2_LOOP_STALL`). `MotorOutputGate` chốt cứng khi khác RUN |
| Cử chỉ START | §2.3, §12.2 | Options giữ liên tục [1.0 s, 3.0 s] rồi nhả mới START. Nhả sớm (<1s) hoặc giữ quá 3s coi như hủy |
| Cử chỉ CLEAR | §2.3, §12.2 | Share giữ 2.0 s với link fresh/neutral/safe. Chỉ đưa về READY, **tuyệt đối không auto-start** |
| Phân loại chẩn đoán (B2) | §7.1, §12.5 | 4 mức: `INFO`, `WARN` (không chặn), `ERROR` (chặn build + upload), `HW_BLOCKED` (chặn upload, cho phép mock host) |
| Cập nhật Bridge (B2) | §7.2 | Tài liệu hóa yêu cầu refactor `tools/arduino-bridge.mjs` tại Phase 4: lọc theo severity thay vì chặn mọi warning string |
| Project Schema V2 & Devices (B3) | §4.1, §12.6 | Định dạng `format: "codelab-project"`, `version: 2`. Tích hợp hai chiều trường `deviceConfigs` của nhánh `codex/integrate-bach-ui`. `scriptUid` định danh hat |
| My Blocks & Inlining (B4) | §3.5, §5.7, §12.4 | Type `codelab_v2_proc_*`, mở rộng inline tại chỗ gọi, kiểm tra DAG (báo `V2_PROC_RECURSION` nếu đệ quy), cấp phát PC continuation cho nested wait, quota 1024 ops / 256 B frame |
| Gán trục và dấu PS4 | §4.3, §12.2 | LY tiến (`+ = up`), LX xoay (`+ = CW/phải`), RX ngang (`+ = phải`). Chuẩn hóa một lần tại adapter |
| Motor ramp & limits | §4.1 | Giữ nguyên slew rate 12.0 unit/s (0.012 duty/ms) từ fast100. Giới hạn = `min(profile, device, motor)` |
| Giới hạn thời gian AUTO | §2.2, §3.4 | Chạm `autoMaxRunSeconds` (mặc định 15 s) chuyển `FAULT` (`V2_AUTO_MAX_RUNTIME`) |
| Ngân sách scheduler G1 | §9.2 | Restored acceptance ceilings and deterministic fixture: 16 scripts, 1024 static expanded ops, 256 ops/script/tick, 2ms, 16KiB, 64KiB |

---

## 2. Báo cáo Chi tiết Xử lý Blockers B1–B4 (G0.1)

### 2.1. Blocker B1 — Kiến trúc An toàn (Safety Architecture)

- **Vấn đề ban đầu:** Chưa rõ Safety Monitor chạy đa luồng hay trong cùng vòng lặp; chưa rõ ai phát/nhận heartbeat và cơ chế khóa cổng motor.
- **Giải pháp đã thống nhất trong spec (§2.4, §12.1):**
  1. **Quyền sở hữu cổng ra (`MotorOutputGate`):** Safety Monitor trực tiếp sở hữu và điều khiển cổng phần cứng. Khi trạng thái không phải `RUN` (hoặc khi có STOP/FAULT), gate bị khóa cứng ngay lập tức. Mọi lệnh ghi từ scheduler bị chặn trước khi cleanup script diễn ra.
  2. **Cơ chế nhịp tim (Heartbeat):** Scheduler là bên *phát* (`safetyMonitor.heartbeat(now)` sau mỗi lát cắt thực thi ≤50 ms). Safety Monitor là bên *nhận* và giám sát. Nếu scheduler bị đơ/vòng lặp vô hạn không nhường quyền quá 250 ms, Safety Monitor ngắt cổng và chuyển sang `FAULT` (`V2_LOOP_STALL`).
  3. **Mô hình thực thi:**
     - *Host G1:* Mô phỏng 2 pha xác thực trên đồng hồ ảo: Pha 1 (Safety Monitor + Watchdog + Cử chỉ Control-plane) -> Pha 2 (Cooperative Scheduler dispatch).
     - *ESP32 Hardware:* Safety Monitor chạy task FreeRTOS riêng ưu tiên cao (Core 0), Scheduler chạy trên `loop()` Arduino (Core 1). Tuyệt đối **không** tạo FreeRTOS task riêng cho từng script Blockly.

### 2.2. Blocker B2 — Phân cấp Chẩn đoán & Cầu nối Bridge (Diagnostics & Bridge)

- **Vấn đề ban đầu:** Spec V0.2 có mức WARN không chặn compile, nhưng `tools/arduino-bridge.mjs` trên main từ chối mọi yêu cầu có `payload.warnings?.length > 0`.
- **Giải pháp đã thống nhất trong spec (§7.1, §7.2, §12.5):**
  1. Định nghĩa chuẩn 4 mức severity:
     - `INFO`: Thông tin, không chặn gì.
     - `WARN`: Cảnh báo thiết kế (code mồ côi, trùng kênh ghi). Cho phép biên dịch và nạp.
     - `ERROR`: Lỗi cấu trúc/kiểu/đệ quy. **Chặn biên dịch và chặn nạp.**
     - `HW_BLOCKED`: Lệnh hợp lệ cho mô phỏng host nhưng phần cứng chưa kiểm chứng (`V2_DRIVER_GATED`, `V2_PIN_RESERVED`). **Cho phép biên dịch/chạy host, nhưng CHẶN nạp xuống mạch thật.**
  2. G0.2 ghi rõ hợp đồng cho đúng `POST /api/compile` và `POST /api/upload`; server-held build policy quyết định quyền nạp. Diagnostics từ client không thể cấp quyền nạp. Implementation bridge được giữ nguyên trong task này.

### 2.3. Blocker B3 — Project Schema V2 & Tương thích `deviceConfigs`

- **Vấn đề ban đầu:** Chưa có JSON Schema cụ thể cho Project V2; có nguy cơ xung đột với trường `deviceConfigs` của nhánh `codex/integrate-bach-ui`.
- **Giải pháp đã thống nhất trong spec (§4.1, §7.4, §12.6):**
  1. Cung cấp đầy đủ bản nháp Draft-07 JSON Schema cho `CodeLabProjectV2` với `format: "codelab-project"`, `version: 2`.
  2. Giữ nguyên trường `deviceConfigs` theo từng boardId tương thích 100% với cấu trúc của `robot-devices.js` trên nhánh `codex/integrate-bach-ui`.
  3. Mỗi khối hat được định danh ổn định bằng `scriptUid`.
  4. Quản lý lưu trữ: `codelab.projects.v1` được bảo tồn; các dự án V2 được lưu vào `codelab.projects.v2`. Khi người dùng nâng cấp từ V1, hệ thống tạo bản sao độc lập (opt-in copy), không ghi đè dự án cũ.

### 2.4. Blocker B4 — My Blocks & Inlining State Machine

- **Vấn đề ban đầu:** Chưa có type ổn định cho My Blocks; chưa có cơ chế hỗ trợ lệnh `Đợi` lồng nhau mà không dùng stack FreeRTOS động.
- **Giải pháp đã thống nhất trong spec (§3.5, §5.7, §12.3, §12.4):**
  1. Định nghĩa các type chuẩn: `codelab_v2_proc_def` (định nghĩa), `codelab_v2_proc_call` (gọi), `codelab_v2_proc_arg` (tham số số).
  2. Kiểm tra tĩnh chống đệ quy (DAG check -> `V2_PROC_RECURSION`).
  3. Cơ chế mở rộng inline: Toàn bộ thân thủ tục được inline tại từng chỗ gọi.
  4. Lệnh `Đợi` bên trong thủ tục được cấp phát Program Counter (`pc`) continuation riêng biệt trong frame của script gọi, cho phép resume chính xác mà không tốn chi phí FreeRTOS task động.
  5. Đối số được tính toán 1 lần tại lối vào thủ tục và lưu vào `frameData[]`, ngăn chặn biến bên ngoài làm sai lệch tham số khi script đang suspend.

---

## 3. Thứ tự Module & Interface Đã Khóa

1. **Nhóm Interface cốt lõi đã khóa:**
   - `I1`: Vòng đời & Mã lỗi (`LifecycleState`, `FaultCode`).
   - `I2`: Cử chỉ Control-plane (`ControlPlaneDetector`: Options 1–3s START, Share 2s CLEAR).
   - `I3`: Bộ chuyển đổi PS4 (`Ps4StudentSnapshot`: chuẩn hóa trục học sinh).
   - `I4`: Cổng chốt motor (`IMotorOutputGate`).
   - `I6` & `I6b`: Scheduler ABI, Context frame và My Blocks inlining state machine.
   - `I7`: Diagnostics API có severity.
   - `I8`: JSON Schema V2 tương thích `deviceConfigs`.
2. **Kế hoạch triển khai song song nhiều Agent (G1):**
   - **Agent A (Runtime Host):** Hiện thực `IMotorOutputGate` (mock) và `ISafetyMonitor` trên virtual clock.
   - **Agent B (Scheduler Engine):** Hiện thực `ICooperativeScheduler` round-robin state-machine và phát heartbeat.
   - **Agent C (Generator & Validator):** Sinh mã C++ từ Blockly, inlining My Blocks và kiểm tra DAG / quotas.
   - Cả 3 agent chỉ phụ thuộc vào các interface I1–I8 đã khóa ở §12.

---

## 4. Bộ Acceptance Tests Tối thiểu (G1–G4)

- **G1 (Host Spike - 18 ca):** Kịch bản X/O độc lập (§3.6), STOP lúc 750 ms, triệt tiêu cạnh dồn 100 lần, latch motor 50%, AUTO WAIT/NO_WAIT kết thúc ở 1000 ms, AUTO forever chạm deadline 15 s vào FAULT, My Blocks inline có nested wait, bảo vệ vòng lặp vô hạn yield, wrap millis(), log drop counter.
- **G2 (UI & Migration - 11 ca):** Roundtrip save/load Project V2, mở project V1 ở chế độ Legacy, chuyển đổi V1->V2 tạo bản sao, kiểm tra device missing, chặn `V2_RUN_MODE_MISMATCH`, kiểm tra severity bridge mới.
- **G3 (1 Motor & PS4 Thật - 8 ca):** Cấp nguồn giữ PWM=0, Options giữ [1.0s, 3.0s] rồi nhả vào RUN, rút bridge motor dừng, Share 2s xóa lỗi về READY, đo độ rộng xung tối thiểu.
- **G4 (4WD Drivetrain - 4 ca):** 6 hướng chuyển động mecanum khớp dấu học sinh, áp dụng min bounds công suất, STOP 4 bánh tức thì, chạy thành công các bài mẫu L1–L4.

---

## 5. Quyết định cần Chủ Dự Án (Project Owner) Xác nhận tại Issue #28

| # | Quyết định đề xuất | Mô tả tóm tắt |
|---|---|---|
| **D1** | **Phê duyệt toàn văn V0.2 (G0.1)** | Chuyển trạng thái sang `G0_PASS` để bắt đầu triển khai code G1 |
| **D2** | **Mô hình Safety đa nhiệm trên ESP32** | Core 0: Safety Monitor Task; Core 1: Cooperative Scheduler `loop()` |
| **D3** | **Tham số cử chỉ START & CLEAR** | Options giữ 1.0–3.0 s rồi nhả; Share giữ 2.0 s để xóa lỗi (về READY) |
| **D4** | **AUTO timeout luôn vào FAULT** | Khi hết thời hạn `autoMaxRunSeconds` (mặc định 15 s), chuyển `FAULT` |
| **D5** | **Chuẩn hóa trục PS4 học sinh** | LY tiến (+ lên), LX xoay (+ phải/CW), RX ngang (+ phải) |
| **D6** | **Duy trì tốc độ Ramp 12.0 unit/s** | Giữ nguyên đặc tính bảo vệ cơ khí từ thư viện `CodeLabFast4wd` |
| **D7** | **Mô hình phân loại chẩn đoán 4 mức** | `INFO`, `WARN`, `ERROR` (chặn build), `HW_BLOCKED` (chặn nạp thật) |
| **D8** | **Kế hoạch cập nhật Bridge tại Phase 4** | Sửa `tools/arduino-bridge.mjs` lọc theo severity thay vì chặn mọi warning |
| **D9** | **Tương thích `deviceConfigs`** | Duy trì trường cấu hình robot per-board của nhánh `codex/integrate-bach-ui` |
| **D10**| **Kiến trúc My Blocks Inline** | Không dùng FreeRTOS task riêng, mở rộng inline vào state machine của script |
| **D11**| **Chỉ số benchmark tạm thời G1 (§9.2)** | 16 scripts, 1024 ops tĩnh, 256 ops/tick, 2 ms/tick, 16 KiB RAM, 64 KiB flash |

---

> **Trạng thái:** Toàn bộ công việc kỹ thuật của nhiệm vụ G0.1 đã hoàn tất. Tài liệu sẵn sàng chờ chủ dự án review và phê duyệt tại Issue #28.
