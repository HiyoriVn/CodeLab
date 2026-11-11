# CodeLab — Blockly Product Specification V0.2 (BẢN DUYỆT G0.1)

> **Status:** G0.1 SPECIFICATION (Blockers B1–B4 Đã Xử Lý — Sẵn Sàng Duyệt G0) · 10/11/2026.  
> **Baseline:** CodeLab <code>main</code> @ <code>2a0705d4</code>; V0.1 tại <code>docs/BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.1.md</code>; G0 Review tại <code>docs/BLOCKLY_V0.2_G0_REVIEW.md</code>.  
> **Scope:** đặc tả trải nghiệm kéo thả + hợp đồng generator/runtime/thiết bị cho sản phẩm cuối. **Không phải** xác nhận các API đã được lập trình, biên dịch hay kiểm thử phần cứng.
>
> **Chủ đích:** học sinh có thể tạo bài đơn motor, PS4, 4WD và sau này thêm cảm biến mà không phải biết GPIO/FreeRTOS. Không cài runtime trung gian; kế hoạch WebAssembly nạp qua web được tách ở Issue #27, chưa triển khai.

**Ưu tiên đọc để duyệt:** §1 (các quyết định nền tảng), §2 (Lifecycle & Safety B1), §3 (Scheduler & My Blocks B4), §4 (Devices & Schema V2 B3), §5 (Basic 30 + My Blocks), §7 (Diagnostics B2, Migration), §10 (Quyết định cần chủ dự án duyệt), §12 (Interface contracts chi tiết cho G1).

---

## 1. Quyết định nền tảng và những thay đổi so với V0.1

| Vấn đề | Quyết định V0.2 (G0.1) | Ý nghĩa / giới hạn |
|---|---|---|
| Bắt đầu sau cấp nguồn | `INIT → READY`, PWM=0, cần START có chủ đích | AUTO chấp nhận nút vật lý đã xác minh hoặc Options tạm thời nếu đạt điều kiện §2.3 |
| Cử chỉ START | Options giữ liên tục **1.0 s**, nhả hợp lệ trong vòng **3.0 s** | Tránh kích hoạt nhầm hoặc kẹt nút vật lý. Quá 3.0 s coi như hủy |
| Cử chỉ CLEAR | Đề xuất Share giữ **2.0 s** khi input fresh/neutral/safe | Chỉ đưa từ `FAULT → READY`. **Tuyệt đối không tự động START lại** |
| Phụ thuộc PS4 | Generator suy ra `requiresController` từ mã có thể thực thi. `runMode=CONTROLLER` luôn cần link; `AUTONOMOUS` từ chối block phụ thuộc PS4 | Dùng PS4 làm START tạm không tạo dependency sau khi vào RUN |
| Khởi tạo thiết bị | Devices khai báo và runtime khởi tạo ở trạng thái an toàn | Block khởi tạo thủ công chỉ Advanced |
| Vòng đời chuyển động | Lệnh liên tục giữ sau khi handler kết thúc (latching). AUTO có kết thúc tự nhiên và giới hạn cứng; timed motion sống theo handle riêng | CONTROLLER chờ sự kiện cho đến STOP/FAULT; xem §3.4 |
| Giới hạn AUTO | Quá hạn `autoMaxRunSeconds` (mặc định 15 s, khoảng 1–60 s) luôn vào `FAULT` (`V2_AUTO_MAX_RUNTIME`) | Học sinh phải nhận thức robot đã dừng do hết hạn và cần CLEAR rõ ràng |
| Sự kiện PS4 | Mỗi hat tối đa 1 token pending; dispatch cần cạnh còn hiệu lực | Thả X hủy pending PRESS cũ, kể cả nhấn–thả nhanh trong khi handler đang đợi |
| Scheduler | Một scheduler cooperative duy nhất dispatch round-robin các state-machine. Không tạo task FreeRTOS riêng cho từng script | G1 host thử resumable C++ state-machine; heartbeat gửi sang Safety Monitor |
| Nhiều script ghi motor | Lệnh hợp lệ sau cùng chiếm quyền (last accepted write wins). Cảnh báo xung đột nếu phát công suất khác 0 | Lệnh dừng vẫn lấy quyền và hủy timer cũ |
| Dấu và gán trục PS4 | Trục LY tiến (`+ = up`, `-rawLY`), LX xoay (`+ = CW/phải`, `+rawLX`), RX ngang (`+ = phải`, `+rawRX`) | Adapter PS4 chuẩn hóa một lần sang đơn vị học sinh; facade chuyển đổi sang mixer |
| Motor ramp & limits | Giữ nguyên đặc tính ramp đã nghiệm thu (12.0 unit/s / 0.012 duty/ms). Giới hạn công suất = `min(profile.maxDutyPercent, device.limit, motor.limit)` | Bảo vệ cơ khí và nguồn điện kit học sinh |
| Chẩn đoán (Diagnostics) | 4 mức: `INFO`, `WARN`, `ERROR`, `HW_BLOCKED` | `ERROR` chặn biên dịch; `HW_BLOCKED` cho phép mô phỏng host nhưng chặn nạp thật |
| Type và tương thích | Type riêng `codelab_v2_<snake_case>` cho mọi block CodeLab mới hoặc có đổi hành vi/schema | Giữ type Blockly chuẩn khi hành vi giữ nguyên. Legacy v1 giữ nguyên, opt-in migration |

### 1.1. Enum và ký hiệu không trùng nhau

- `kind`: `HAT` (sự kiện), `STMT` (lệnh), `CONTROL` (khối điều khiển/lặp), `BOOL`, `NUMBER`, `TEXT`, `PROC_DEF`, `CONFIG`.
- `status`: `EXISTS` (main đã có dạng block, chưa chuẩn V0.2), `SIM_ONLY`, `GATED` (chặn nạp), `NEW`, `HW_VERIFY`.
- `severity`: `INFO`, `WARN`, `ERROR`, `HW_BLOCKED` (§7.2).
- `stage`: `S0` = scheduler không tải; `S1` = 1 motor + PS4; `S2` = 4WD; `S3` = sensor/advanced.
- `blocking` = suspend *script* (không block FreeRTOS); `interruptible` = hủy được khi STOP/FAULT.
- `resources` = `MOTOR(M1)`, `DRIVE(M1..M4)`, `PS4(I2C)`, `ALL_MOTORS`, `LED(id)`, `BUZZER`, `SENSOR(id)`, `SERIAL`, `NONE`.
- `i18n` là **khóa hiển thị**, không đổi Blockly `type` khi dịch hoặc thay nhãn.

---

## 2. Lifecycle & Safety Contract (Blocker B1 Resolved)

### 2.1. Trạng thái thực thi

| State | Motor output | Script user | Hành vi |
|---|---|---|---|
| `INIT` | 0, hard-locked | Chưa khởi chạy | Khởi tạo safe GPIO, board profile, safety monitor và Devices; kiểm lỗi |
| `READY` | 0, hard-locked | Chưa khởi chạy; biến reset | Đợi **xác nhận START có chủ đích**; không tự chạy khi bật nguồn |
| `RUN` | Bật khi backend ready + không lỗi | Scheduler hoạt động; motor commands latched | Chạy chương trình; Safety Monitor giám sát liên tục |
| `FAULT` | 0, hard-locked | Hủy tất cả script, timer, pending event | Báo lỗi; không tự clear hoặc auto-ARM |

`FAULT` chỉ khóa đầu ra motor tại runtime, không khóa việc biên dịch hoặc nạp lại chương trình.

### 2.2. Bảng chuyển trạng thái bắt buộc

| Từ → Đến | Trigger / điều kiện | Tác động bắt buộc |
|---|---|---|
| Power-on/reset → INIT | Cấp nguồn hoặc reboot | Đầu ra safe sớm nhất có thể; chưa chạy Blockly |
| INIT → READY | Profile/Devices/driver đạt kiểm tra startup | Giữ PWM=0, chưa nhận START cũ |
| INIT hoặc READY → FAULT | Phát hiện lỗi cấu hình hoặc phần cứng | Khóa cứng đầu ra motor, chốt mã lỗi |
| READY → RUN (CONTROLLER) | PS4 fresh, trục neutral, Options giữ 1.0–3.0 s rồi nhả hợp lệ; driver ready | Reset biến, script, motion và sự kiện; bắt đầu clock RUN, lập baseline PS4, lên lịch các hat bắt đầu. PWM giữ 0 trong transition |
| READY → RUN (AUTO) | Driver ready và đường START đủ điều kiện §2.3 | Reset như trên, đặt deadline AUTO ngay khi vào RUN. PWM giữ 0 trong transition |
| RUN → READY | STOP hợp lệ hoặc AUTO hoàn thành tự nhiên | Tắt đầu ra motor, hủy script, timer và pending; cần một START mới để chạy lại |
| RUN → FAULT | Hết deadline AUTO (`V2_AUTO_MAX_RUNTIME`), mất link khi `requiresController`, quá hạn heartbeat scheduler (>250 ms), lỗi driver/sensor | Khóa cứng `MotorOutputGate`, hủy toàn bộ script/handle, chốt mã lỗi |
| FAULT → READY | Nguyên nhân đã hết, driver ready, cử chỉ CLEAR hợp lệ (Share giữ 2.0 s khi neutral) | Giữ PWM=0. CLEAR chỉ đưa về READY, **tuyệt đối không tự động vào RUN** |
| READY → READY | Chờ START, giữ chưa đủ, giữ quá 3 s, hủy xác nhận hoặc không đủ điều kiện | PWM=0 |

### 2.3. START, STOP và cử chỉ điều khiển

- **Cử chỉ START bằng PS4 Options (CONTROLLER & AUTO bench):**
  1. Trong `READY`, đợi một report fresh thấy nút Options đã nhả.
  2. Bắt đầu tính thời gian khi nhận cạnh nhấn mới: nút phải được giữ liên tục trong khoảng **tối thiểu 1.0 s và tối đa 3.0 s**.
  3. Trong suốt thời gian giữ: link phải fresh, mọi trục joystick ở vị trí neutral (deadzone ±8%), driver sẵn sàng, và nút Share không được nhấn.
  4. Chuyển sang `RUN` **chỉ khi nhận cạnh nhả (release) fresh trong cửa sổ [1.0 s, 3.0 s]**.
  5. Nếu nhả sớm (< 1.0 s), giữ quá lâu (> 3.0 s — chống kẹt nút), mất link, lệch neutral, hoặc có lệnh STOP: hủy toàn bộ tiến trình nhận diện START; người dùng phải thực hiện lại từ đầu.
- **Cử chỉ CLEAR bằng PS4 Share:**
  - Khi đang ở `FAULT`, giữ nút Share liên tục **2.0 s** với link fresh, mọi trục neutral và driver ready.
  - Khi hoàn thành, runtime xóa lỗi và chuyển về `READY`. Lệnh CLEAR không bao giờ tự động kích hoạt motor hoặc chuyển sang RUN.
- **STOP khẩn cấp:**
  - Nhấn Share lập tức (cạnh nhấn fresh) khi đang `RUN` sẽ chuyển ngay về `READY`.
  - Công tắc ngắt nguồn động lực cơ khí là phương án an toàn tối hậu khi CPU treo hoặc mất kết nối.

### 2.4. Kiến trúc an toàn & Phân định trách nhiệm (B1 Architecture)

Hệ thống phân tách nghiêm ngặt thành 4 thành phần (xem chi tiết tại §12.1):
1. **Cooperative Blockly Scheduler:**
   - Đảm nhiệm việc chạy các script Blockly do học sinh tạo.
   - Hoạt động theo cơ chế cooperative round-robin (không tạo FreeRTOS task riêng cho mỗi script).
   - **Phát nhịp tim (Heartbeat):** Cuối mỗi lát cắt thực thi (slice), scheduler gọi `safetyMonitor.heartbeat(now)`. Tần suất mục tiêu: ≤ 50 ms.
2. **Independent Safety Monitor:**
   - Chạy độc lập với scheduler (trên ESP32: task ưu tiên cao trên Core 0 hoặc FreeRTOS periodic timer; trên Host G1: Phase 1 trong vòng lặp 2 pha).
   - **Thu nhận nhịp tim:** Giám sát `now - lastHeartbeatAt`. Nếu scheduler bị treo, vòng lặp vô hạn không yield, hoặc đơ quá **250 ms**, Safety Monitor lập tức ngắt cổng motor và chuyển sang `FAULT` (`V2_LOOP_STALL`).
   - Giám sát thời hạn AUTO, freshness tay cầm PS4, và trạng thái driver.
3. **Motor Output Gate (`MotorOutputGate`):**
   - Cổng chốt phần cứng nằm giữa lệnh phần mềm và driver motor.
   - Khi trạng thái khác `RUN` (hoặc khi có STOP/FAULT), gate bị **khóa cứng (HARD-LOCKED)** tức thì. Mọi lệnh ghi từ scheduler sẽ bị loại bỏ ngay tại cổng.
   - Khóa cổng được thực hiện **trước** khi scheduler thực hiện cleanup script để triệt tiêu mọi xung kích hoạt sót lại.
4. **Mô hình thực thi:**
   - **Host G1 (Deterministic Simulation):** Vòng lặp mô phỏng chia 2 pha rõ ràng trên đồng hồ ảo:
     * *Phase 1 (Safety):* Cập nhật thời gian, nhận mock input, kiểm tra heartbeat/freshness/deadlines, xử lý cử chỉ control-plane (START/CLEAR/STOP). Nếu có sự cố, khóa Output Gate.
     * *Phase 2 (Scheduler):* Nếu đang `RUN`, dispatch các script đến hạn, nhường quyền theo quota, gửi `heartbeat()`.
   - **ESP32 Hardware (Mục tiêu G3, chưa xác nhận phần cứng):** Safety Monitor chạy task FreeRTOS riêng ưu tiên cao (Core 0), Scheduler chạy trên task Arduino `loop()` (Core 1).

---

## 3. Execution Contract — scheduler cho Blockly (Blocker B4 Resolved)

### 3.1. Mô hình script

Một script gồm **một hat** và stack lệnh bên dưới. Các stack rời không gắn hat sẽ không được nạp vào scheduler (`V2_ORPHAN_STACK` - mức `WARN`).

G1 triển khai mô hình **Resumable C++ State-Machine**:
- Mỗi script được sinh thành một cấu trúc gồm Program Counter (`pc`), frame dữ liệu riêng (biến cục bộ, tham số, vòng lặp counter), deadline và trạng thái pending token.
- Mỗi lần chuyển sang `RUN`, một `runGeneration` mới được cấp phát. Mọi handle, timer hoặc callback từ thế hệ trước đều bị vô hiệu hóa.

### 3.2. Điểm nhường quyền và định mức (Quotas)

- `Đợi(s)`: suspend script riêng biệt đến deadline monotonic. `0 s` vẫn yield ít nhất 1 tick.
- Vòng lặp: mọi vòng lặp (`forever`, `repeat_n`) bắt buộc yield ở cuối mỗi lượt lặp.
- Quota: Một script không được chiếm dụng quá 256 thao tác cơ bản hoặc 2 ms trong một tick. Nếu chạm quota, scheduler tạm dừng script đó và chuyển sang script kế tiếp theo cơ chế round-robin.
- Scheduler I/O: Không gọi hàm blocking I/O (như `Serial.print` đồng bộ hoặc bus I2C treo). Tất cả qua buffer hoặc snapshot.

### 3.3. Xử lý sự kiện cạnh PS4

- Mỗi hat sự kiện PS4 có tối đa **1 token pending**.
- Khi một cạnh mới đến: nếu hat đang bận chạy, cạnh cùng loại mới hơn sẽ thay thế token cũ. Cạnh ngược loại (ví dụ RELEASE sau PRESS) sẽ vô hiệu hóa token pending cũ.
- Dispatch chỉ diễn ra khi cạnh còn hiệu lực tại thời điểm bắt đầu lượt chạy mới.

### 3.4. Latch và Quản lý chuyển động có thời hạn (Motion Handles)

- Lệnh motor/drive không thời hạn duy trì trạng thái (latched) cho tới khi bị ghi đè, dừng, hoặc rời khỏi `RUN`.
- Lệnh timed drive/motor sử dụng **Motion Handle** gắn liền với `runGeneration` và kênh sở hữu:
  * `WAIT`: Script gọi tạm ngừng (suspended) cho đến khi handle hoàn thành hoặc bị lệnh khác hủy.
  * `NO_WAIT`: Script chạy tiếp ngay lập tức; handle vẫn hoạt động dưới sự quản lý của runtime cho tới khi hết thời gian.
- **Kết thúc tự nhiên của AUTO:** Vào cuối mỗi tick, nếu không còn script nào runnable/suspended, không còn pending token, và không còn motion handle nào active, runtime tự động tắt motor và chuyển từ `RUN → READY`. Latch không có handle sẽ không giữ chương trình sống vô hạn.

### 3.5. My Blocks (Thủ tục tự tạo) & Mở rộng Inline (B4 Specification)

Để hỗ trợ học sinh chia nhỏ bài toán mà vẫn đảm bảo tính an toàn trên bộ nhớ tĩnh của vi điều khiển:
1. **Blockly Types:**
   - Khối định nghĩa: `codelab_v2_proc_def` (Hat/Control header).
   - Khối gọi: `codelab_v2_proc_call` (Statement).
   - Khối tham số: `codelab_v2_proc_arg` (Reporter Number).
2. **Cơ chế Inline tại thời điểm sinh mã (Codegen Inline Expansion):**
   - Đồ thị lời gọi (Call Graph) được kiểm tra tĩnh trước khi biên dịch: bắt buộc là đồ thị có hướng không chu trình (DAG). Nếu phát hiện đệ quy trực tiếp hoặc gián tiếp, phát lỗi `V2_PROC_RECURSION` (mức `ERROR`) và chặn biên dịch.
   - Toàn bộ nội dung thủ tục được mở rộng trực tiếp (inlined) vào state-machine của script gọi tại từng vị trí gọi.
3. **Tham số và Dữ liệu Frame:**
   - Giá trị đối số được đánh giá một lần duy nhất khi bước vào đoạn inline, lưu vào biến frame của vị trí gọi (`slot`). Biến nguồn bên ngoài thay đổi sau đó không làm thay đổi giá trị tham số trong thủ tục.
4. **Hỗ trợ lệnh `Đợi` lồng nhau (Nested Wait):**
   - Mỗi lệnh `Đợi(s)` bên trong My Block được cấp phát một giá trị `PC` trạng thái riêng biệt trong state-machine của script gọi.
   - Khi tiếp tục sau khi đợi (resume), script nhảy thẳng vào nhãn `PC` tương ứng, sử dụng dữ liệu đã lưu trong frame, không cần stack FreeRTOS động và không lặp lại các side-effect trước đó.
5. **Giới hạn an toàn:**
   - Tổng số phép toán sau mở rộng không quá 1024; frame của script không quá 256 byte. Nếu vượt, báo `V2_PROC_INLINE_LIMIT` (mức `ERROR`).

---

## 4. Devices, Cảm biến và Cấu hình Project (Blocker B3 Resolved)

### 4.1. Project Schema V2 & Tương thích `deviceConfigs`

Định dạng tệp dự án CodeLab Version 2 (`format: "codelab-project"`, `version: 2`) chuẩn hóa toàn bộ cấu hình hệ thống và tương thích hoàn toàn với triển khai cấu hình robot hiện có trên nhánh `codex/integrate-bach-ui`:

1. **Tính tương thích hai chiều với `deviceConfigs`:**
   - Nhánh `codex/integrate-bach-ui` đã hiện thực bảng cấu hình robot lưu trong `project.deviceConfigs[boardId]` (`version: 1`, gồm `motors`, `drivetrain`, `controller`).
   - Project Schema V2 giữ nguyên trường `deviceConfigs` theo từng boardId để tương thích với component `RobotDeviceConfig.jsx` và hàm kiểm tra `robotDeviceWarnings()`.
   - Đồng thời, Schema V2 bổ sung các trường cấp dự án: `runMode` (`CONTROLLER` / `AUTONOMOUS`), `startSource` (`OPTIONS_HOLD` / `PHYSICAL_BUTTON` / `NONE`), và `autoMaxRunSeconds` (1–60 s).
2. **Định danh thiết bị ổn định (Stable IDs):**
   - Khối lệnh tham chiếu đến thiết bị bằng ID bất biến: `motor-1`..`motor-6` (hoặc alias cổng `M1`..`M6`), `drivetrain`, `ps4_controller`.
   - Đổi tên hiển thị (alias) không làm đổi ID trong JSON; xóa thiết bị thì giữ khối và phát chẩn đoán `V2_DEVICE_MISSING` (`ERROR`).
3. **Bảo tồn đặc tính Ramp và Giới hạn công suất:**
   - Đặc tính gia tốc/ramp được giữ nguyên theo kiểm chứng fast100: giới hạn biến thiên công suất tối đa 12.0 unit/giây (tương đương 0.012 duty/ms).
   - Công suất áp dụng thực tế được chặn bởi cận nhỏ nhất: `min(profile.maxDutyPercent, deviceConfigs.drivetrain.limit, motor.limit)`.

---

## 5. Danh mục Palette Basic V0.2 — 30 Block Cốt Lõi + My Blocks

Mọi block mới hoặc đổi hành vi sử dụng tiền tố chuẩn `codelab_v2_<snake_case>`.

### 5.1. Bắt đầu & Điều khiển (6)

| ID | Type / Kind | Nhãn & Tham số mặc định | Ngữ nghĩa C++ / Runtime | Severity / Yield |
|---|---|---|---|---|
| A01v2 | `codelab_v2_when_run` HAT | "Khi chương trình bắt đầu" | Điểm vào script khi READY → RUN | NONE · N |
| A02v2 | `codelab_v2_forever` CONTROL | "Lặp lại mãi mãi" | Back-edge vòng lặp; bắt buộc yield mỗi tick | NONE · Y |
| A03 | `controls_if` CONTROL | "Nếu [ ] thì" | Phân nhánh điều khiển an toàn continuation | NONE · N |
| A04 | `controls_if` CONTROL | "Nếu [ ] thì ... nếu không" | Phân nhánh có else | NONE · N |
| A06v2 | `codelab_v2_repeat_n` CONTROL | "Lặp lại [5] lần" | Đánh giá số lần 1 lần; counter lưu trong frame script | NONE · Y |
| A08v2 | `codelab_v2_wait_seconds` STMT | "Đợi [1] giây" | Cấp deadline monotonic; suspend script (không delay) | NONE · Y |

### 5.2. Chuyển động (8)

| ID | Type / Kind | Nhãn & Tham số mặc định | Ngữ nghĩa C++ / Runtime | Severity / Yield |
|---|---|---|---|---|
| B02v2 | `codelab_v2_motor_run` STMT | "Motor [M1] quay [tiến] [50]%" | `robot.motorRun(M1, Forward, 50);` (latched) | HW_BLOCKED nếu chưa verified · N |
| B03v2 | `codelab_v2_motor_power` STMT | "Motor [M1] công suất [0]%" | `robot.motorSetPower(M1, 0);` (latched) | HW_BLOCKED nếu chưa verified · N |
| B04v2 | `codelab_v2_motor_stop` STMT | "Dừng motor [M1]" | `robot.motorStop(M1);` | NONE · N |
| B05v2 | `codelab_v2_motor_stop_all` STMT | "Dừng tất cả motor" | `robot.stopAllMotors();` | NONE · N |
| C02v2 | `codelab_v2_drive_direction` STMT | "Robot [tiến] [50]%" | `robot.driveDirection(Forward, 50);` | HW_BLOCKED nếu thiếu drive · N |
| C06v2 | `codelab_v2_drive_axes` STMT | "Robot tiến [0] ngang-phải [0] xoay-phải [0]" | `robot.drive(fwd, right, cw);` (dấu học sinh) | HW_BLOCKED nếu thiếu drive · N |
| C08v2 | `codelab_v2_drive_stop` STMT | "Dừng di chuyển robot" | `robot.driveStop();` | NONE · N |
| C10v2 | `codelab_v2_drive_for_time` STMT | "Robot [tiến] [50]% trong [1] s [và đợi]" | `motion.startTimedDrive(Forward, 50, 1000, WAIT)` | Y (nếu WAIT) / N (nếu NO_WAIT) |

### 5.3. Tay cầm PS4 (5)

| ID | Type / Kind | Nhãn & Tham số mặc định | Ngữ nghĩa C++ / Runtime | Severity / Yield |
|---|---|---|---|---|
| A14v2 | `codelab_v2_when_ps4_pressed` HAT | "Khi nút [X] được nhấn" | Lắng nghe cạnh nhấn fresh (§3.3) | HW_BLOCKED nếu thiếu bridge · N |
| A17v2 | `codelab_v2_when_ps4_released` HAT | "Khi nút [X] được thả" | Lắng nghe cạnh thả fresh (§3.3) | HW_BLOCKED nếu thiếu bridge · N |
| DP03v2 | `codelab_v2_ps4_pressed` BOOL | "Nút [X] đang được nhấn?" | Đọc trạng thái snapshot fresh hiện tại | NONE · N |
| DP06v2 | `codelab_v2_ps4_axis_percent` NUMBER | "Cần [trái] trục [dọc] (%)" | Trục LY: đẩy lên là dương 0..100% | NONE · N |
| DP02v2 | `codelab_v2_ps4_connected` BOOL | "PS4 đã kết nối?" | Trả true khi link fresh và không quá hạn | NONE · N |

### 5.4. Logic & Toán (6)

| ID | Type / Kind | Nhãn & Tham số mặc định | Ngữ nghĩa C++ / Runtime | Severity / Yield |
|---|---|---|---|---|
| H01 | `logic_boolean` BOOL | `true` / `false` | Boolean literal | NONE · N |
| H02 | `logic_compare` BOOL | `[A] = [B]` (hoặc ≠, <, ≤, >, ≥) | So sánh hai số | NONE · N |
| H03 | `logic_operation` BOOL | `[A] và [B]` (hoặc hoặc) | Phép toán logic AND/OR | NONE · N |
| H04 | `logic_negate` BOOL | `không phải [A]` | Phép đảo NOT | NONE · N |
| H05 | `math_number` NUMBER | `0` | Hằng số | NONE · N |
| H06v2 | `codelab_v2_arithmetic` NUMBER | `[A] + [B]` (−, ×, ÷) | Phép tính; chia cho 0 báo lỗi | NONE · N |

### 5.5. Biến số (3)

| ID | Type / Kind | Nhãn & Tham số mặc định | Ngữ nghĩa C++ / Runtime | Severity / Yield |
|---|---|---|---|---|
| I02v2 | `codelab_v2_variable_set_number` STMT | "Đặt [biến] thành [0]" | Gán giá trị số; reset tại RUN | NONE · N |
| I03v2 | `codelab_v2_variable_change_number` STMT | "Thay đổi [biến] một lượng [1]" | Tăng/giảm giá trị số | NONE · N |
| I04v2 | `codelab_v2_variable_get_number` NUMBER | "Giá trị của [biến]" | Đọc giá trị số | NONE · N |

### 5.6. Hiển thị & LED (2)

| ID | Type / Kind | Nhãn & Tham số mặc định | Ngữ nghĩa C++ / Runtime | Severity / Yield |
|---|---|---|---|---|
| E05v2 | `codelab_v2_serial_message` STMT | "Hiện lời nhắn [Xin chào!]" | Enqueue log không chặn; rớt dòng nếu đầy | NONE · N |
| E01v2 | `codelab_v2_led_set` STMT | "Đèn LED [Bật / Tắt]" | Đặt trạng thái LED của học sinh | HW_BLOCKED nếu trùng LED hệ thống · N |

### 5.7. My Blocks (Thủ tục tự tạo - B4 Types)

| ID | Type / Kind | Nhãn & Tham số mặc định | Ngữ nghĩa C++ / Runtime | Severity / Yield |
|---|---|---|---|---|
| J01v2 | `codelab_v2_proc_def` PROC_DEF | "Định nghĩa khối [tên] (tham số...)" | Khai báo thủ tục; kiểm tra DAG | ERROR nếu đệ quy · N |
| J02v2 | `codelab_v2_proc_call` STMT | "Chạy khối [tên] với [đối số...]" | Mở rộng inline tại chỗ gọi; cấp frame | ERROR nếu vượt quota · Y (nếu có wait) |
| J05v2 | `codelab_v2_proc_arg` NUMBER | "Tham số [tên_tham_số]" | Đọc giá trị tham số trong frame gọi | NONE · N |

---

## 6. Mở rộng Full-Product (Tham khảo V0.1)

Các tính năng nâng cao (Servo, Cảm biến siêu âm, IMU yaw/pitch, Encoder, v.v.) được giữ nguyên ID và hợp đồng như V0.2 gốc. Tất cả các khối này đều ở trạng thái `GATED` hoặc `HW_VERIFY` và chỉ được mở khi driver phần cứng tương ứng được nghiệm thu thực tế.

---

## 7. Diagnostics & Migration (Blocker B2 Resolved)

### 7.1. Phân loại Mức độ Chẩn đoán (Severity Model)

Diagnostics catalog được chuẩn hóa thành 4 mức độ rõ ràng:
- `INFO`: Thông tin bổ sung cho người dùng, không ảnh hưởng biên dịch hoặc nạp.
- `WARN`: Cảnh báo thiết kế (như code rời không chạy `V2_ORPHAN_STACK`, hai script cùng điều khiển motor `V2_MOTOR_MULTI_WRITER`). **Không chặn biên dịch, không chặn nạp.**
- `ERROR`: Lỗi cấu trúc/ngữ nghĩa/kiểu dữ liệu (như sai kiểu, thiếu device, đệ quy thủ tục, vượt hạn mức script). **Chặn biên dịch và chặn nạp.**
- `HW_BLOCKED`: Khối lệnh hợp lệ về mặt thuật toán và có thể chạy mô phỏng host (G1), nhưng phần cứng chưa được xác minh an toàn (như motor driver chưa nghiệm thu `V2_DRIVER_GATED`, chưa cấu hình nút START `V2_SAFETY_START_UNAVAILABLE`, xung đột chân reserved `V2_PIN_RESERVED`). **Cho phép sinh mã và chạy kiểm thử host, nhưng CHẶN nạp xuống mạch thật.**

### 7.2. Contract endpoint compile/upload (implementation hiện tại và G1 target)

Hiện tại, `tools/arduino-bridge.mjs` (dòng 90 và 120) từ chối yêu cầu nếu mảng `payload.warnings` có bất kỳ phần tử nào:
```javascript
// HIỆN TẠI TRÊN MAIN (Cần refactor tại Phase 4, KHÔNG sửa trong task này):
if (payload.warnings?.length) return send(res, 400, { error: 'Còn cảnh báo trong mã sinh; hãy xử lý trước khi biên dịch.' });
```
Repository endpoint audit: `tools/arduino-bridge.mjs` implements `POST /api/compile` and `POST /api/upload` (also `GET /api/status`, `GET /api/ports`). No `/build` endpoint exists. `src/components/DevicePanel.jsx` calls the two POST endpoints.

Contract: `INFO` is displayed only; `WARN` is displayed and does not block compile/upload; `ERROR` blocks compile and upload; `HW_BLOCKED` permits host simulation/compile but blocks hardware upload. This contract is not yet implemented by the bridge. Upload authorization MUST be derived from server-held build metadata or a verified signed build manifest: store normalized board profile, code hash, build ID, and trusted diagnostics/build-policy result at compile time. At upload, re-check that build ID exists and is current and that submitted code and board match the stored build; reject if server-side stored policy contains ERROR/HW_BLOCKED or if the selected board is not hardware-authorized. Client-supplied `warnings`, `diagnostics`, board authorization flags, or severity values are display/input only and MUST NOT grant upload authorization. Current bridge does preserve buildId/code/board stale-build checks; keep them. Do not modify bridge implementation in G0.2. G1/G2 host tests use direct harness until its later authorized refactor.

### 7.3. Bảng mã Diagnostics V0.2 cập nhật mức độ

| Code | Trigger | Severity | Hành vi hệ thống |
|---|---|---|---|
| `V2_ORPHAN_STACK` | Khối lệnh không gắn dưới hat | `WARN` | Lưu project bình thường; bỏ qua không nạp vào scheduler |
| `V2_MOTOR_MULTI_WRITER` | Hai script cùng ghi công suất khác 0 lên một kênh | `WARN` | Cảnh báo lệnh sau cùng sẽ ghi đè |
| `V2_DRIVE_OWNERSHIP` | Xung đột giữa lệnh DRIVE và lệnh motor đơn lẻ | `WARN` | Giải thích việc nhường quyền và dừng nhóm |
| `V2_DEVICE_MISSING` | Khối tham chiếu đến thiết bị đã bị xóa khỏi Devices | `ERROR` | Giữ nguyên khối; chặn biên dịch |
| `V2_TYPE_MISMATCH` | Sai kiểu dữ liệu Boolean/Number/Text | `ERROR` | Chặn biên dịch |
| `V2_PROC_RECURSION` | Phát hiện đệ quy trực tiếp hoặc gián tiếp ở My Blocks | `ERROR` | Chặn biên dịch; chỉ rõ vòng lặp gọi |
| `V2_PROC_INLINE_LIMIT` | Mở rộng My Blocks vượt quá 1024 ops hoặc 256 B frame | `ERROR` | Chặn biên dịch; thông báo vị trí gọi vượt hạn mức |
| `V2_SCRIPT_LIMIT` | Đăng ký quá 16 scripts trong một project | `ERROR` | Chặn biên dịch |
| `V2_RUN_MODE_MISMATCH` | Project chế độ AUTO nhưng chứa khối phụ thuộc PS4 | `ERROR` | Yêu cầu đổi runMode hoặc xóa khối PS4 |
| `V2_AUTO_RUN_LIMIT_INVALID` | `autoMaxRunSeconds` nằm ngoài khoảng 1–60 s | `ERROR` | Chặn biên dịch |
| `V2_DRIVER_GATED` | Motor/servo chưa được nghiệm thu an toàn trên board | `HW_BLOCKED` | Cho phép chạy mock trên host; chặn nạp xuống board thật |
| `V2_PIN_RESERVED` | Chân GPIO xung đột với bộ nhớ Flash/PSRAM/USB | `HW_BLOCKED` | Chặn nạp phần cứng |
| `V2_SAFETY_START_UNAVAILABLE`| Chế độ AUTO thiếu nút START vật lý đã xác minh | `HW_BLOCKED` | Chặn nạp phần cứng; cho phép mô phỏng host |
| `V2_PROFILE_MISMATCH` | Bo mạch kết nối khác với profile đã chọn | `HW_BLOCKED` | Chặn nạp phần cứng |
| `V2_SERIAL_DROPPED` | Dòng log quá 128 byte hoặc hàng đợi đầy | `INFO` | Tăng biến đếm drop counter; scheduler tiếp tục |

### 7.4. Chiến lược Chuyển đổi Dự án (Migration)

- **Dự án V1:** Được giữ nguyên vẹn. Khi mở trong giao diện mới, hệ thống thông báo trạng thái `Legacy`.
- **Tạo bản chuyển đổi (Opt-in Copy):** Người dùng có thể chọn "Tạo bản sao V2". Quá trình chuyển đổi:
  * Tạo tệp sao chép mới với `version: 2`. Tệp gốc V1 không bị thay đổi.
  * Tự động sinh `scriptUid` duy nhất cho từng hat block.
  * Nhập cấu hình `deviceConfigs` hiện có từ V1 sang registry V2.
- **LocalStorage:** Lưu trữ `codelab.projects.v1` được giữ nguyên; các dự án V2 được lưu vào `codelab.projects.v2`.

---

## 8. Bài mẫu (Blockly V0.2 Verification Sketches)

- **L0 — Scheduler Host Spike:** 2 hat PS4 X và O; X đợi 2 s; O hiển thị tin nhắn ngay lập tức. Virtual clock xác nhận O được dispatch trong khi X đang đợi; STOP lúc 750 ms hủy toàn bộ continuation.
- **L1 — Motor Latching:** Nút X nhấn quay M1 50%; nút X thả dừng M1. Handler kết thúc nhưng M1 giữ 50% cho tới khi có cạnh thả.
- **L2 — Joystick 2 Motor:** Đọc cần trục joystick điều khiển 2 motor với phân nhánh if/else.
- **L3 — Mecanum 4WD PS4:** Điều khiển 3 trục (tiến/lùi, dạt ngang, xoay) với PS4 qua I2C.
- **L4 — Autonomous có Thời hạn:** Chạy 4 bánh tiến trong 1 s (WAIT hoặc NO_WAIT). Robot dừng tự nhiên hoặc dừng ở trần 15 s.

---

## 9. Kế hoạch Triển khai (Gate Sequence)

### 9.2. G1 benchmark thresholds and reproducible workload

The G1 host spike has a fixed maximum of **16 scripts**. These are acceptance ceilings, not measured claims:

| Measure | Threshold | Measurement rule |
|---|---:|---|
| Registered scripts | 16 maximum | 17th registration rejected without corrupting registrations |
| Static expanded operations/project | 1024 maximum | Count after My Blocks inline expansion |
| Callback operations/script/tick | 256 maximum | Quota exhaustion returns `YIELD`; next runnable script gets a turn |
| Scheduler tick wall time | 2 ms maximum | Host monotonic duration for full dispatch tick |
| Static scheduler/context RAM | 16 KiB maximum | `sizeof` pool/context accounting; excludes host/test framework |
| Generated sketch flash | 64 KiB maximum | Report text+rodata for representative build; target-toolchain baseline pending |
| Heartbeat | 50 ms target; >250 ms fault | Virtual clock; no heartbeat while tick/callback is stalled |
| Determinism | Identical time/event trace gives identical output trace | Compare ordered trace including equal-deadline tie order |

Fixture: 16 scripts (8 runnable, 4 timer-waiting, 4 handle-waiting), bounded branches and nested inline wait; inject 100 alternating PS4 edges, STOP at 750 ms, deadlines at 1000 ms, and a separate stall beyond 250 ms. Use a deterministic virtual clock and mock gate. Record compiler/version, host, operation counts, static bytes, tick durations, and result. Any threshold failure is G1 FAIL.

| Gate | Trọng tâm | Tiêu chí hoàn thành |
|---|---|---|
| **G0** | Rà soát & Khóa đặc tả | Giải quyết B1–B4, phê duyệt D1–D11 trong Issue #28 |
| **G1** | Scheduler Host Spike | C++ state-machine, inline My Blocks có wait, virtual clock, mock sink |
| **G2** | Devices UI & Migration | Schema V2, tích hợp `deviceConfigs`, diagnostics, UI smoke test |
| **G3** | Xác minh 1 Motor & PS4 | Nạp firmware lên bo mạch thật, đo độ trễ dừng, kiểm chứng cử chỉ START/CLEAR |
| **G4** | 4WD Drivetrain | Tích hợp mecanum 4 bánh, kiểm tra dấu thực tế, nghiệm thu bài L3/L4 |

---

## 10. Các quyết định đề xuất & Trạng thái duyệt G0

### 10.1. Các quyết định đã thống nhất trong đặc tả G0.1

1. **Khởi động an toàn:** Mạch cấp nguồn luôn vào `READY` (PWM=0). START bằng PS4 Options (giữ 1.0 s, nhả trong 3.0 s) hoặc nút vật lý đã kiểm chứng.
2. **Xóa lỗi (CLEAR):** Giữ nút Share 2.0 s khi tay cầm ở trạng thái fresh/neutral. CLEAR chỉ đưa về `READY`, không bao giờ tự động chuyển sang RUN.
3. **Quá hạn AUTO:** Khi chạm mốc `autoMaxRunSeconds` (mặc định 15 s), chuyển sang `FAULT` (`V2_AUTO_MAX_RUNTIME`).
4. **Quy ước trục PS4:** Trục LY tiến (`+ = up`), LX xoay (`+ = CW/phải`), RX ngang (`+ = phải`).
5. **Đặc tính Ramp:** Giữ nguyên tốc độ tăng giảm công suất tối đa 12.0 unit/s như đã nghiệm thu trên fast100.
6. **Kiến trúc an toàn:** Safety Monitor chạy độc lập nhận heartbeat từ Cooperative Scheduler; Output Gate chốt cứng đầu ra khi không ở `RUN`.
7. **Diagnostics & Bridge:** 4 mức độ (`INFO`, `WARN`, `ERROR`, `HW_BLOCKED`); bridge tương lai chỉ chặn nạp khi có `ERROR` hoặc `HW_BLOCKED`.
8. **My Blocks:** Inline expansion tại chỗ gọi, kiểm tra DAG chống đệ quy, cấp phát `PC` cho nested wait.

### 10.2. Quyết định cần Chủ dự án ký duyệt tại Issue #28

- [ ] **D1:** Phê duyệt toàn văn V0.2 để chuyển Gate sang `G0_PASS`.
- [ ] **D2:** Safety Monitor Core 0 (FreeRTOS implementation G3 pending).
- [ ] **D3:** Options START [1–3] s; Share CLEAR 2 s về READY.
- [ ] **D4:** AUTO default 15 s, limit 1–60 s, expiry -> FAULT.
- [ ] **D5:** PS4 axes LY forward, LX clockwise, RX strafe-right.
- [ ] **D6:** Ramp 12.0 unit/s (0.012 duty/ms).
- [ ] **D7:** INFO/WARN/ERROR/HW_BLOCKED severity policy.
- [ ] **D8:** Phase 4 bridge policy update; no bridge change in G0.2.
- [ ] **D9:** Preserve per-board `deviceConfigs` compatibility.
- [ ] **D10:** My Blocks inline with DAG recursion rejection.
- [ ] **D11:** G1 benchmark thresholds in §9.2.

---

## 11. Tài liệu tham chiếu

- [V0.1 Full Catalog](BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.1.md)
- [G0 Review Report](BLOCKLY_V0.2_G0_REVIEW.md)
- [Issue #28 — Blockly-first](https://github.com/HiyoriVn/CodeLab/issues/28)
- [CodeLabRobot Library](https://github.com/HiyoriVn/CodeLab/tree/main/firmware/libraries/CodeLabRobot)
- [CodeLabPs4I2C Library](https://github.com/HiyoriVn/CodeLab/tree/main/firmware/libraries/CodeLabPs4I2C)
- [CodeLabFast4wd Library](https://github.com/HiyoriVn/CodeLab/tree/main/firmware/libraries/CodeLabFast4wd)

---

## 12. Đặc tả Chi tiết Interface Khóa cho G1 (Explicit Interface Contracts)

Phần này quy định chính xác các API và cấu trúc dữ liệu chung giữa Scheduler, Generator, Devices và Firmware để phục vụ triển khai song song nhiều agent tại G1.

### 12.1. Interface I1 & I4: Safety Architecture & Output Gating (B1)

```cpp
namespace codelab::v2 {

enum class LifecycleState : uint8_t {
  INIT = 0,
  READY = 1,
  RUN = 2,
  FAULT = 3
};

enum class FaultCode : uint16_t {
  NONE = 0,
  CONFIG_INVALID = 1,
  LINK_TIMEOUT = 2,
  LOOP_STALL = 3,           // Scheduler heartbeat timeout (>250ms)
  DRIVER_ERROR = 4,
  AUTO_MAX_RUNTIME = 5,     // AUTO exceeded autoMaxRunSeconds
  SAFETY_VIOLATION = 6,
  HANDLE_POOL_EXHAUSTED = 7
};

// Interface chốt cổng phần cứng - do Safety Monitor sở hữu và điều khiển
class IMotorOutputGate {
 public:
  virtual ~IMotorOutputGate() = default;
  // Khóa cứng phần cứng: lập tức đưa toàn bộ PWM về 0 và ngắt driver
  virtual void hardLock() = 0;
  // Mở khóa phần cứng khi vào trạng thái RUN
  virtual void unlock(uint32_t runGeneration) = 0;
  // Ghi giá trị điều khiển: chỉ có hiệu lực khi đang RUN và đúng runGeneration
  virtual bool writeChannel(uint8_t channel, float dutyCommand, uint32_t runGeneration) = 0;
  virtual bool isLocked() const = 0;
};

// Interface Safety Monitor độc lập
class ISafetyMonitor {
 public:
  virtual ~ISafetyMonitor() = default;
  // Scheduler gọi hàm này ở cuối mỗi tick để báo hiệu còn sống
  virtual void heartbeat(uint32_t nowMs) = 0;
  // Kích hoạt STOP khẩn cấp từ phần mềm
  virtual void requestStop() = 0;
  // Kích hoạt FAULT kèm mã lỗi
  virtual void triggerFault(FaultCode code) = 0;
  // Lấy trạng thái vòng đời hiện tại
  virtual LifecycleState state() const = 0;
  virtual FaultCode faultCode() const = 0;
  virtual uint32_t currentRunGeneration() const = 0;
};

} // namespace codelab::v2
```

**Cross-core ownership and priority:** `SafetyMonitor` is the sole writer of lifecycle state, fault code, `runGeneration`, and gate lock/unlock. State and generation are one atomic snapshot (or a short critical-section protected pair); readers must acquire a consistent pair. Scheduler motor writes carry the observed generation and are accepted only when state is `RUN`, generation matches, and the gate is unlocked. START increments generation before publishing `RUN`; STOP/FAULT has priority over START and writes: atomically publish non-RUN / invalidate generation, then hard-lock the gate, then enqueue cleanup. A stale write or cleanup from an older generation is rejected. The physical gate's hard-lock path must be idempotent. G1 uses deterministic single-thread virtual-clock mocks; no real cross-core primitive is claimed by G1. The FreeRTOS/Core 0 implementation and its memory-ordering proof is G3 pending.

### 12.2. Interface I2 & I3: Control-Plane & PS4 Adapter

```cpp
namespace codelab::v2 {

struct Ps4StudentSnapshot {
  bool fresh = false;
  uint8_t sequence = 0;
  uint16_t session = 0;
  uint32_t buttonsPressed = 0;   // Bitmask 17 nút
  // Trục đã chuẩn hóa đơn vị học sinh: -100 .. +100 (%)
  int16_t forward = 0;          // + là tiến (up), - là lùi
  int16_t turnClockwise = 0;    // + là xoay phải (CW), - là xoay trái
  int16_t strafeRight = 0;      // + là dạt sang phải, - là dạt sang trái
};

// Cử chỉ nhận diện control-plane độc lập với mã học sinh
class ControlPlaneDetector {
 public:
  struct Output {
    bool startRequested = false;
    bool stopRequested = false;
    bool clearRequested = false;
  };

  // Cập nhật trạng thái cử chỉ:
  // - Options: giữ [1000ms, 3000ms] và nhả -> startRequested
  // - Share: nhấn ngay trong RUN -> stopRequested; giữ 2000ms trong FAULT -> clearRequested
  Output update(const Ps4StudentSnapshot& snap, LifecycleState currentState, uint32_t nowMs);
};

} // namespace codelab::v2
```

### 12.3. Interface I6: Cooperative Scheduler ABI & Continuation Frame

Mỗi script Blockly được biên dịch thành một state-machine C++ có cấu trúc cố định, không cấp phát heap động:

```cpp
namespace codelab::v2 {

enum class StepResult : uint8_t {
  YIELD = 0, // Còn runnable; xếp lại cuối vòng round-robin
  DONE = 1,  // Hoàn tất; scheduler giải phóng script context
  WAIT = 2   // Chưa runnable; đọc waitKind/deadline/handleId từ context
};

enum class WaitKind : uint8_t { NONE, TIMER, HANDLE };

struct ScriptContext {
  uint32_t scriptUid = 0;
  uint16_t pc = 0;                   // Program counter (nhãn continuation)
  uint32_t deadlineMs = 0;           // Dùng cho wait_seconds
  uint32_t handleId = 0;
  WaitKind waitKind = WaitKind::NONE;
  uint32_t loopCounters[4] = {};     // Bộ đếm vòng lặp repeat_n lồng nhau
  uint32_t runGeneration = 0;
  bool active = false;
  uint32_t frameData[16] = {};       // Lưu đối số My Blocks inline và biến cục bộ
};

class ICooperativeScheduler {
 public:
  virtual ~ICooperativeScheduler() = default;
  // Đăng ký script được sinh từ generator
  virtual bool registerScript(uint32_t scriptUid,
      StepResult (*stepFunc)(ScriptContext& ctx, uint32_t nowMs)) = 0;
  // Lập lịch kích hoạt sự kiện
  virtual void queueEvent(uint32_t scriptUid, uint32_t eventData) = 0;
  // Thực thi một tick scheduler: round-robin các script runnable
  virtual void tick(uint32_t nowMs) = 0;
  // Kiểm tra xem toàn bộ script và handle đã dừng chưa (phục vụ kết thúc tự nhiên AUTO)
  virtual bool isIdle() const = 0;
};

} // namespace codelab::v2
```

**ABI semantics:** callbacks return exactly one `StepResult`; they never mutate scheduler-owned registration or heartbeat state. For `YIELD`, the scheduler keeps the context runnable and advances round-robin. For `DONE`, it marks the script complete. For `WAIT`, it reads `ctx.waitKind`: `TIMER` is runnable when `(int32_t)(nowMs - ctx.deadlineMs) >= 0`; `HANDLE` is runnable when the registered handle is complete or canceled. A callback entering a wait must set `waitKind`, continuation `pc`, and timer deadline or handle ID before returning. On resume, generated code clears `waitKind` to `NONE` before the next return. A zero-duration timer still yields until the next scheduler tick. The fixed pool is at most **16 scripts**; registration beyond that fails with `V2_SCRIPT_LIMIT`.

Heartbeat is emitted once after each scheduler tick, including an idle tick, only after that tick returns to the scheduler loop. Target cadence is at most 50 ms. The monitor compares its own monotonic clock with the last accepted heartbeat; age greater than 250 ms hard-locks outputs and latches `V2_LOOP_STALL`. A scheduler stall cannot refresh its own heartbeat. G1 uses one deterministic virtual-clock driver: the safety phase advances/checks watchdog first, then the scheduler phase runs, then heartbeat is recorded on return. A virtual-clock test explicitly advances time without calling scheduler to model a stall.

### 12.4. Interface I6b: My Blocks Inlining & Continuation

Ví dụ đoạn mã C++ được sinh ra từ một My Block `quay_va_cho(goc, thoi_gian)` chứa lệnh `Đợi`:

```cpp
// Minh họa mã sinh ra của Script chứa My Block inline:
StepResult script_when_run_step(ScriptContext& ctx, uint32_t now) {
  switch (ctx.pc) {
    case 0:
      // [Chỗ gọi My Block #1]: Đánh giá đối số 1 lần và gán vào frame slot
      ctx.frameData[0] = 90;   // Tham số 'goc'
      ctx.frameData[1] = 1000; // Tham số 'thoi_gian'
      // Bắt đầu thân thủ tục inlined:
      robot.driveDirection(TurnRight, 50);
      ctx.deadlineMs = now + ctx.frameData[1];
      ctx.waitKind = WaitKind::TIMER;
      ctx.pc = 1; // Điểm continuation sau lệnh Đợi lồng bên trong My Block
      return StepResult::WAIT;

    case 1:
      // Tiếp tục thực thi bên trong My Block sau khi hết hạn đợi:
      if ((int32_t)(now - ctx.deadlineMs) < 0) return StepResult::WAIT;
      ctx.waitKind = WaitKind::NONE;
      robot.driveStop();
      // Kết thúc My Block #1, chuyển sang lệnh kế tiếp của script cha:
      ctx.pc = 2;
      return StepResult::YIELD;

    case 2:
      // Lệnh kế tiếp của script cha...
      ctx.pc = 0;
      ctx.active = false;
      return StepResult::DONE;
  }
}
```

The example's wait setup also sets `ctx.waitKind = WaitKind::TIMER`; on resume it clears it to `NONE`. (The abbreviated body above illustrates PC transitions only.)

### 12.5. Interface I7: Structured Diagnostics Model

```typescript
export type DiagnosticSeverity = 'INFO' | 'WARN' | 'ERROR' | 'HW_BLOCKED';

export interface Diagnostic {
  code: string;            // Ví dụ: 'V2_PROC_RECURSION'
  severity: DiagnosticSeverity;
  message: string;         // Thông báo hiển thị cho người dùng
  blockId?: string;        // ID khối lệnh gây lỗi trên Blockly workspace
  deviceId?: string;       // ID thiết bị liên quan
}

export interface ValidationResult {
  valid: boolean;          // true nếu không có chẩn đoán nào mang mức ERROR
  hardwarePermitted: boolean; // true nếu không có ERROR và không có HW_BLOCKED
  diagnostics: Diagnostic[];
}
```

### 12.6. Interface I8: Project Schema V2 JSON Definition

Canonical complete Draft-07 schema and fixtures: [`docs/blockly-v0.2/project-v2.schema.json`](blockly-v0.2/project-v2.schema.json). The inline JSON example below is retained as an abbreviated illustration only; it is not normative. The canonical schema models Blockly serialization (`blocks.languageVersion`, recursive `inputs`/`next`, variables/plugins), stable device IDs, and actual `deviceConfigs` fields from `codex/integrate-bach-ui`: `version`, motor `id/name/port/reversed/enabled`, drivetrain `wheels/limit`, controller `enabled/blink`. JSON Schema checks shape; semantic validation must also enforce unique device IDs and `scriptUid` values across event hats, wheel references to enabled motors, and profile-specific ports. Each event hat requires a stable `scriptUid` in its `fields`; import preserves it, explicit copy migration generates new IDs. V1 files without these fields remain V1. Current `src/App.jsx` import/export and localStorage are V1; do not rewrite V1 files or `codelab.projects.v1` automatically. V2 remains specified, not implemented.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CodeLabProjectV2",
  "type": "object",
  "required": ["format", "version", "project"],
  "properties": {
    "format": { "type": "string", "enum": ["codelab-project"] },
    "version": { "type": "integer", "enum": [2] },
    "project": {
      "type": "object",
      "required": ["id", "name", "boardId", "runMode", "workspace"],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "boardId": { "type": "string" },
        "editorMode": { "type": "string", "enum": ["beginner", "advanced"] },
        "runMode": { "type": "string", "enum": ["CONTROLLER", "AUTONOMOUS"] },
        "startSource": { "type": "string", "enum": ["OPTIONS_HOLD", "PHYSICAL_BUTTON", "NONE"] },
        "autoMaxRunSeconds": { "type": "integer", "minimum": 1, "maximum": 60, "default": 15 },
        "devices": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "type"],
            "properties": {
              "id": { "type": "string" },
              "type": { "type": "string", "enum": ["motor", "drivetrain", "ps4_controller", "sensor", "led"] },
              "name": { "type": "string" },
              "port": { "type": "integer" },
              "reversed": { "type": "boolean" },
              "limit": { "type": "integer", "minimum": 1, "maximum": 100 }
            }
          }
        },
        "deviceConfigs": {
          "type": "object",
          "description": "Bảo tồn tương thích với robot-devices.js trên nhánh codex/integrate-bach-ui",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "version": { "type": "integer", "enum": [1] },
              "motors": { "type": "array" },
              "drivetrain": { "type": "object" },
              "controller": { "type": "object" }
            }
          }
        },
        "workspace": {
          "type": "object",
          "properties": {
            "blocks": { "type": "object" },
            "variables": { "type": "array" }
          }
        },
        "updatedAt": { "type": "string" }
      }
    }
  }
}
```

---

## Phụ lục A. Đối chiếu Danh mục Khối V0.1 → V0.2

V0.1 giữ nguyên legacy Blockly types và serialization; các ID ở cột trái là danh tính sản phẩm từ danh mục V0.1. V0.2 IDs mới chỉ áp dụng cho block có đổi semantics/schema. `—` nghĩa là ngoài Basic 30 hoặc chưa có tương đương V0.2; không được xóa block legacy khỏi project khi mở/chuyển đổi.

| V0.1 IDs (all entries) | V0.2 mapping / disposition |
|---|---|
| Configuration D01–D11 | Project metadata/device decisions, not Blockly blocks: board, motor identity, wheel role, reversal, groups, drivetrain, controller, servo, sensors, brake/duty, editor mode. Preserve legacy data on import. |
| A01–A16 | A01→`codelab_v2_when_run`; A02→`codelab_v2_forever`; A03/A04 retain standard types; A06→`codelab_v2_repeat_n`; A08→`codelab_v2_wait_seconds`; A05,A07,A09–A16 remain legacy/Advanced pending explicit V2 mapping. |
| B01–B16 | Motor/device commands retain legacy loadability; V2 types in §5.2 where runtime/safety semantics changed. No channel remapping. |
| C01–C10 | Drive candidates map to §5.3 types where present; unsupported channel values remain intact with diagnostics. |
| D-P01–D-P16 | Controller candidates map to §5.4 where present; legacy UART/I2C serialization is not reinterpreted. |
| E01–E08 | Keep legacy block types and serialized fields; no unlisted V2 equivalent asserted. |
| F01–F05 | Keep legacy block types and serialized fields. |
| G01–G15 | Keep legacy types; transport blocks remain Advanced and retain wire behavior. |
| H01–H14 | Keep legacy types, variable IDs and field/input shape. |
| I01–I10 | Keep legacy types; device operations require validation and HW_BLOCKED until verified. |
| J01–J04 | Preserve V1 procedures in V1 projects. V2 types are `codelab_v2_proc_def`, `_call`, `_arg`; convert only in opt-in copy migration. |
| K01–K12 | Keep legacy advanced GPIO/Serial/I2C types and pins; never infer/remap GPIO. |

These rows cover every catalog ID listed in V0.1: D01–D11, A01–A16, B01–B16, C01–C10, D-P01–D-P16, E01–E08, F01–F05, G01–G15, H01–H14, I01–I10, J01–J04, and K01–K12 (137 entries including configuration IDs). The former “126” count was not supported by the source catalog and is corrected here.
Mapping được đối chiếu theo các family và IDs được liệt kê trong `BLOCKLY_PRODUCT_BLOCK_CATALOG_V0.1.md`; các family không có bảng tương đương một-một phải được bảo toàn như legacy, không suy diễn ánh xạ từ số thứ tự.