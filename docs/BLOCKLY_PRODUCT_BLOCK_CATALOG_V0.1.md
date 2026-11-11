# Đặc tả bộ khối CodeLab cho sản phẩm cuối — bản duyệt V0.1

> **Tình trạng:** ĐỀ XUẤT / CHƯA TRIỂN KHAI. Ngày 10/11/2026.
>
> **Mục đích:** Chốt danh mục block, hình dạng, tham số, giá trị mặc định, ngữ nghĩa và mã C++ dự kiến trước khi giao Codex triển khai. **Không** coi các API C++ đề xuất bên dưới là thư viện đã có hoặc đã được biên dịch.
>
> **Baseline đọc:** nhánh <code>main</code>, commit <code>2a0705d4b38b4c982f4490fcb3a9e566beb1f6e5</code>, gồm <code>src/blocks</code>, <code>src/generators/arduino.js</code>, <code>src/boards/profiles.js</code>, <code>src/components/BlocklyWorkspace.jsx</code> và <code>tests</code>. Theo Issue #28, phần Blockly cần hoàn thiện **trước** PoC WASM #27.

## 0. Phạm vi, ký hiệu và quy tắc đánh giá

**Đối tượng:** học sinh tiểu học/THCS tiếp cận Scratch, sau đó học điều khiển robot và Arduino C++ mức cao. Tham khảo **mô hình tương tác**, không sao chép mã/giao diện, của VEXcode IQ: khai báo Devices riêng; block điều khiển motor; Controller; Control/Events; My Blocks.

**Loại block**: <code>H</code> = mũ/sự kiện bắt đầu (hat); <code>S</code> = lệnh có nối trên/dưới (statement); <code>C</code> = khối chứa lệnh (C-shape); <code>B</code> = trả về đúng/sai (Boolean); <code>N</code> = trả về số; <code>T</code> = trả về chữ; <code>D</code> = cấu hình thiết bị trong giao diện, **không phải block**.

**Ưu tiên**: <code>P0</code> cần cho phiên bản Blockly robot hữu dụng; <code>P1</code> cần cho bản giáo dục đầy đủ; <code>P2</code> mở rộng/thiết bị phụ hoặc phụ thuộc xác minh.

**Hiện trạng**:
- <code>E</code>: block/logic cơ bản đã có trên main (có thể chưa đúng tên hiển thị đề xuất).
- <code>M</code>: chỉ mô phỏng hoặc adapter cũ; **chưa** tương đương bộ nhận PS4 I²C thật.
- <code>G</code>: đã có block giao diện nhưng generator **cố ý chặn compile** (motor/servo).
- <code>N</code>: chưa có block/runtime tương ứng; **API đề xuất**.
- <code>H</code>: phải xác minh driver/cảm biến/power gate trước khi cho compile/upload ra phần cứng.

**Quy ước tham số:** số phần trăm công suất <code>0..100</code>; lệnh công suất có dấu <code>-100..100</code>; joystick được đưa về <code>-100..100</code> ở lớp giáo dục (adapter hiện tại dùng <code>-1000..1000</code>); <code>bool</code> = true/false. Giá trị theo phần trăm là **PWM duty yêu cầu**, không phải đo tốc độ RPM. Mỗi dòng trong bảng là **một block/nhóm biến thể cụ thể**, không được gộp ẩn thành một lệnh "PS4 điều khiển tất cả".

**Mã C++:** 
- C++ trong cột cuối là **ví dụ biểu thức/lệnh mà Blockly dự kiến sinh**. 
- <code>robot.*</code>, <code>ps4.*</code>, <code>sensors.*</code>, <code>ui.*</code> là **facade API cần phát triển**, không hiện diện nguyên dạng trên main. Các tên định danh <code>M1</code>, <code>X</code>, <code>LX</code>, <code>Forward</code>, <code>Coast</code> là enum đề xuất.
- Những dòng khớp generator hiện có (ví dụ <code>delay</code>, <code>Serial.println</code>, <code>if</code>) được ghi rõ.
- Trong bảng, <code>...</code> chỉ thân block học sinh thả vào; không phải đoạn C++ đầy đủ có thể compile độc lập.

### Trạng thái board cần được hiển thị đúng

| Board | Số kênh | Nguồn chân GPIO ở profile hiện tại | Quyền phát motor từ Blockly |
|---|---:|---|---|
| Newmania Starter V1 được mô tả trong <code>main</code> | M1–M4 | M1 35/36, M2 37/38, M3 39/40, M4 41/42 | Hiện <code>motorControl:false</code>; **chưa bật** |
| STEAM Robotics V2 theo profile <code>main</code> | M1–M6 | M1 42/41, M2 40/39, M3 38/37, M4 36/35, M5 48/34, M6 33/47 | Hiện <code>motorControl:false</code>; **chưa bật** |
| Board thử vật lý 4WD chạy firmware <code>fast100</code> | Bốn motor đã được người dùng kiểm thử | Build thử: flash 16MB, PSRAM disabled, SDA8/SCL9, bridge 0x30 | Firmware thử nghiệm là baseline vật lý; **chưa có trong git tree main**, phải đối chiếu bản local và profile chính xác trước tích hợp |

Không được áp cấu hình V1 8MB/QSPI hoặc V2 sang board vật lý 16MB/PSRAM disabled nếu chưa xác minh. Không được mặc định "6 kênh V2" đồng nghĩa "6 driver đã test". Servo và motor có encoder chỉ được bật sau khi qua gate phần cứng tương ứng.

## 1. Cấu hình Thiết bị robot (Devices) — riêng khỏi Blockly

Giống tư tưởng VEXcode IQ, học sinh chọn/chỉnh **thiết bị trước**, sau đó block dùng tên motor, không nhập chân PWM.

| ID | Mục cấu hình (D) | Mục đích | Tham số và mặc định | C++ dự kiến sinh trong setup / metadata | Ưu tiên / trạng thái |
|---|---|---|---|---|---|
| D01 | Chọn bo mạch | Chọn map và capability | <code>board = chưa chọn</code> cho dự án mới điều khiển robot; dự án legacy giữ ID cũ | <code>RobotConfig cfg = profileConfig(boardId);</code> | P0/N |
| D02 | Thêm/đặt tên motor | Gắn tên dễ hiểu với kênh vật lý | <code>M1</code>, tên <code>"Motor M1"</code>; chỉ M1–M4 V1/M1–M6 V2 | <code>cfg.motor[M1].name = "Motor M1";</code> | P0/N |
| D03 | Vai trò bánh xe | Chỉ định vị trí bánh trong robot | <code>M1=FL, M2=FR, M3=RL, M4=RR</code> **là template tùy chỉnh**, không tự suy từ phần cứng | <code>cfg.mecanum.assign(FL,M1);</code> | P0/N |
| D04 | Đảo chiều motor | Chuẩn hóa "tiến" theo cơ khí | mặc định <code>false</code>; template <code>fast100</code> M1/M2 đảo chiều khi đã xác nhận | <code>cfg.motor[M1].inverted = true;</code> | P0/N |
| D05 | Nhóm motor | Gán nhiều motor vào nhóm | <code>Group1=[M1,M2]</code> sau khi người dùng chọn; mặc định rỗng | <code>cfg.group(Group1,{M1,M2});</code> | P1/N |
| D06 | Drivetrain | Chọn kiểu bánh | <code>NONE</code> mặc định, tùy chọn 2WD/4WD mecanum; không áp mecanum cho V2 6-motor bất kỳ | <code>cfg.driveType = MECANUM4;</code> | P0/N |
| D07 | Tay cầm | Chọn adapter, kết nối | <code>PS4 via D1/I2C</code>; SDA=8, SCL=9, addr=0x30, freshness=250ms là preset **chỉ** cho profile đã xác minh | <code>cfg.ps4 = {I2C,8,9,0x30,250};</code> | P0/N |
| D08 | Servo | Gán servo theo kênh và giới hạn cơ khí | S1..S4 V1 hoặc S1..S6 V2; góc giả định 90°, khoảng 0..180° **không phải giới hạn an toàn thực** | <code>cfg.servo[S1] = ServoConfig(...);</code> | P2/H |
| D09 | Cảm biến | Gán tên với loại, cổng, địa chỉ | chưa thêm mặc định; loại Digital/Analog/Ultrasonic/Color/IMU/Encoder | <code>cfg.addSensor(sensorSpec);</code> | P1–P2/H |
| D10 | Chế độ hãm/công suất | Các giới hạn an toàn riêng driver | motor max 100% trong template đã test; brake/coast phải theo driver và nghiệm thu | <code>cfg.maxDutyPercent=100;</code> | P0/N |
| D11 | Trình chỉnh sửa | Chọn Cơ bản/Nâng cao, không remap project | <code>Cơ bản</code> mới; dự án cũ không metadata vẫn Nâng cao | Chỉ metadata UI; **không sinh C++** | P0/E |

**Nguyên tắc:** cấu hình tên, role, đảo chiều phải có **một nguồn sự thật**. Block "Khởi tạo motor" phía dưới là cách giảng dạy để khởi tạo thiết bị đã khai báo; không được âm thầm thay pin hay đảo ngược thiết lập Devices. Gán một motor vào hai vai trò mecanum hoặc dùng cùng kênh cho hai nhóm xung đột phải báo lỗi.

## 2. Danh mục block chi tiết

### A. Bắt đầu, điều khiển và sự kiện

| ID | Block (tên hiển thị đề xuất) | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| A01 | Khi bắt đầu chương trình | H | Chạy một lần | thân <code>DO</code> (rỗng) | <code>void setup(){ ... }</code> | P0/E |
| A02 | Lặp lại mãi mãi | C | Chạy lặp các lệnh con | thân <code>DO</code> (rỗng) | <code>void loop(){ ...; delay(1); }</code> theo generator cũ; cần điều phối nhiều stack | P0/E |
| A03 | Nếu ... thì | C | Rẽ nhánh | điều kiện <code>false</code> | <code>if (condition) { ... }</code> | P0/E |
| A04 | Nếu ... thì / Nếu không | C | Hai nhánh | điều kiện <code>false</code> | <code>if (condition) {...} else {...}</code> | P0/E |
| A05 | Nếu ... / nếu không nếu ... | C | Nhiều điều kiện | điều kiện thứ hai <code>false</code> | <code>else if (condition2) {...}</code> | P1/E (native mutator) |
| A06 | Lặp lại [5] lần | C | Lặp số lần | <code>times=5</code> | <code>for (uint32_t i=0; i&lt;codelabRepeatCount(5); ++i) {...}</code> | P0/E |
| A07 | Lặp đến khi [đúng] | C | Lặp cho tới khi điều kiện đúng | <code>condition=false</code> | <code>while (!(condition)) { ...; robot.yieldSafe(); }</code> | P0/E (safety wrapper N) |
| A08 | Đợi [1] giây | S | Tạm dừng chuỗi lệnh | <code>seconds=1</code>, 0..60 | <code>delay(1000);</code> đã có; runtime bảo vệ motor không phụ thuộc delay | P0/E |
| A09 | Đợi đến khi [đúng] | S | Chờ điều kiện mà không treo safety | <code>condition=false</code> | <code>while (!(condition)) { robot.yieldSafe(); }</code> | P1/N |
| A10 | Lặp khi [đúng] | C | Vòng lặp điều kiện | <code>condition=false</code> | <code>while (condition) {...; robot.yieldSafe();}</code> | P1/E (native Advanced) |
| A11 | Thoát vòng lặp | S | Break vòng lặp hiện tại | không | <code>break;</code> | P1/E (Advanced) |
| A12 | Dừng chương trình an toàn | S | Dừng logic học sinh và tải | không | <code>robot.stopProgram();</code> | P1/N |
| A13 | Thời gian từ khi bật mạch | N | Đồng hồ ms hoặc giây | đơn vị <code>giây</code> | <code>millis()/1000.0</code> | P1/N |
| A14 | Khi nút PS4 [X] vừa nhấn | H | Sự kiện cạnh lên, không gọi lặp liên tục | <code>button=X</code> | <code>if (ps4.justPressed(X)) { ... }</code> (poll/event dispatch) | P1/N |
| A15 | Khi PS4 mất kết nối | H | Sự kiện chuyển sang mất link | không | <code>if (ps4.justDisconnected()) { ... }</code>; motor đã stop độc lập | P1/N |
| A16 | Khi nhận thông điệp [start] | H | Sự kiện nội bộ giữa các stack | <code>name="start"</code> | <code>if (events.take("start")) {...}</code> | P2/N |

**Lưu ý:** nhiều block dạng <code>H</code> trong cùng workspace không được giả vờ chạy song song bằng việc nối lần lượt các vòng vô hạn. Cần chốt execution model (scheduler/cooperative events) và test starvation; mọi motor an toàn vẫn do runtime độc lập quản lý.

### B. Động cơ đơn lẻ và nhóm motor

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| B01 | Khởi tạo động cơ [M1] | S (chỉ setup) | Kích hoạt kênh đã khai báo trong Devices, ở trạng thái dừng | <code>M1</code> | <code>robot.initMotor(M1);</code> | P0/N |
| B02 | Động cơ [M1] quay [tiến] tốc độ [30]% | S | Điều khiển một motor độc lập | <code>M1</code>; <code>Forward</code>; <code>30%</code> | <code>robot.motorRun(M1, Forward, 30);</code> | P0/G |
| B03 | Đặt công suất động cơ [M1] bằng [0]% | S | Giá trị có dấu để ghép joystick/số học | <code>M1</code>, <code>power=0</code> (-100..100) | <code>robot.motorSetPower(M1, 0);</code> | P0/N |
| B04 | Dừng động cơ [M1] | S | Dừng 1 kênh | <code>M1</code> | <code>robot.motorStop(M1);</code> | P0/G |
| B05 | Dừng tất cả động cơ | S | Dừng mọi kênh đã cấu hình | không | <code>robot.stopAllMotors();</code> | P0/N |
| B06 | Đặt tốc độ tối đa motor [M1] là [100]% | S | Chặn duty ở kênh | <code>M1</code>, <code>100%</code> | <code>robot.motorLimit(M1,100);</code> | P1/N |
| B07 | Đổi chiều motor [M1] | S (chỉ setup) | Cập nhật đảo chiều đúng một lần | <code>M1</code>, <code>inverted=false</code> | <code>robot.motorInvert(M1,false);</code> | P1/N |
| B08 | Chạy motor [M1] trong [1] giây | S | Chạy có giới hạn thời gian và dừng | <code>M1</code>, tiến, <code>30%</code>, <code>1s</code> | <code>robot.motorRunFor(M1,Forward,30,1000);</code> | P1/N |
| B09 | Động cơ [M1] đang được ra lệnh chạy? | B | Kiểm tra lệnh, **không xác nhận bánh thật quay** | <code>M1</code> | <code>robot.motorCommanded(M1)</code> | P1/N |
| B10 | Công suất đang đặt cho [M1] (%) | N | Đọc yêu cầu PWM trước áp driver | <code>M1</code> | <code>robot.motorCommandPercent(M1)</code> | P1/N |
| B11 | Nhóm [G1] quay [tiến] tốc độ [30]% | S | Điều khiển nhóm có sẵn | <code>G1</code>, tiến, 30% | <code>robot.groupRun(G1,Forward,30);</code> | P1/N |
| B12 | Dừng nhóm [G1] | S | Dừng motor trong nhóm | <code>G1</code> | <code>robot.groupStop(G1);</code> | P1/N |
| B13 | Đặt kiểu dừng [thả trôi] cho [M1] | S | Chọn coast/brake nếu driver thực hỗ trợ | <code>M1</code>, <code>Coast</code> | <code>robot.motorStopMode(M1,Coast);</code> | P2/H |
| B14 | Motor [M1] quay [90] độ | S | Điều khiển theo vị trí, **chỉ khi có encoder/PID** | <code>M1</code>, <code>90°</code>, 30% | <code>robot.motorMoveDegrees(M1,90,30);</code> | P2/H |
| B15 | Vị trí motor [M1] (độ) | N | Phản hồi từ encoder | <code>M1</code> | <code>robot.motorAngleDeg(M1)</code> | P2/H |
| B16 | Motor [M1] tiêu thụ dòng [A] | N | Đọc cảm biến dòng thực | <code>M1</code> | <code>robot.motorCurrentA(M1)</code> | P2/H |

**Chốt semantics:** không sao chép các lệnh VEX Smart Motor như <code>hold</code>, torque/current/RPM/position nếu board không có phản hồi tương ứng. Với robot PWM hiện tại chỉ cam kết yêu cầu duty, lệnh dừng, giới hạn và trạng thái driver.

### C. Điều khiển hệ truyền động (Drivetrain / Mecanum)

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| C01 | Khởi tạo robot [4 bánh mecanum] | S (setup) | Tạo drivetrain từ Devices, xác minh đủ 4 role | <code>Mecanum4</code> | <code>robot.initDrive(Mecanum4);</code> | P0/N |
| C02 | Robot tiến tốc độ [30]% | S | Vận tốc tiến | <code>30%</code> | <code>robot.drive(30,0,0);</code> | P0/N |
| C03 | Robot lùi tốc độ [30]% | S | Vận tốc lùi | <code>30%</code> | <code>robot.drive(-30,0,0);</code> | P0/N |
| C04 | Robot đi ngang [trái] tốc độ [30]% | S | Strafe mecanum | <code>Left</code>, <code>30%</code> | <code>robot.strafe(Left,30);</code> | P0/N |
| C05 | Robot xoay tại chỗ [trái] tốc độ [30]% | S | Quay quanh tâm | <code>Left</code>, <code>30%</code> | <code>robot.rotate(Left,30);</code> | P0/N |
| C06 | Di chuyển theo trục: tiến [0] ngang [0] xoay [0] (%) | S | Kết hợp 3 trục, normalize mixer | <code>vx=0</code>, <code>vy=0</code>, <code>omega=0</code> | <code>robot.drive(vx,vy,omega);</code> | P0/N |
| C07 | Đặt tốc độ tối đa robot [100]% | S | Giới hạn mọi bánh trong drivetrain | <code>100%</code> | <code>robot.driveLimit(100);</code> | P0/N |
| C08 | Dừng robot | S | Dừng drivetrain và motor liên quan | không | <code>robot.driveStop();</code> | P0/N |
| C09 | Robot đã cấu hình đủ bánh? | B | Xác nhận role, số kênh và driver ready | không | <code>robot.driveReady()</code> | P1/N |
| C10 | Robot chạy [tiến] trong [1] giây | S | Bài thực hành theo thời gian | tiến, <code>30%</code>, <code>1s</code> | <code>robot.driveFor(Forward,30,1000);</code> | P1/N |

**Quy tắc chuyển động:** sử dụng mixer trong CodeLabRobot với thứ tự FL/FR/RL/RR và cấu hình đảo chiều từ Devices; normalize tổng lệnh để PWM không vượt giới hạn. Khi chạy lệnh motor riêng và drivetrain cùng lúc, cần chọn owner/priority rõ ràng; **không chồng hai nguồn PWM**. Nếu chưa có cơ chế arbitration, generator báo xung đột khi cùng điều khiển kênh.

### D. Tay cầm PS4 thật (ESP32 D1 → I²C → S3)

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| D-P01 | Kết nối tay cầm PS4 | S (setup) | Dùng adapter D1 0x30, không BT trực tiếp trên S3 | <code>I2C</code>, SDA8, SCL9, addr0x30 từ Devices | <code>ps4.beginI2c(8,9,0x30);</code> | P0/M (legacy khác protocol) |
| D-P02 | PS4 đã kết nối? | B | Dữ liệu hợp lệ, còn fresh | không | <code>ps4.connected()</code> | P0/M |
| D-P03 | Nút [X] đang được nhấn? | B | Đọc nút, dùng trong if | <code>X</code> | <code>ps4.pressed(X)</code> | P0/M |
| D-P04 | Nút [Options] vừa nhấn? | B | Rising edge, một lần mỗi lần nhấn | <code>Options</code> | <code>ps4.justPressed(Options)</code> | P0/N |
| D-P05 | Nút [X] vừa thả? | B | Falling edge | <code>X</code> | <code>ps4.justReleased(X)</code> | P1/N |
| D-P06 | Cần [trái] trục [dọc] (%) | N | Chọn LX/LY/RX/RY, normalize và deadzone | trái/dọc LY, deadzone <code>6%</code> | <code>ps4.axisPercent(LY)</code> | P0/M (main chỉ trái) |
| D-P07 | Cần trái: tiến/lùi (%) | N | Chuyển LY theo hướng robot | <code>LY</code>, dấu tùy preset vật lý | <code>ps4.forwardPercent()</code> | P0/N |
| D-P08 | Cần trái: xoay (%) | N | Chuyển LX thành lệnh xoay | <code>LX</code> | <code>ps4.turnPercent()</code> | P0/N |
| D-P09 | Cần phải: đi ngang (%) | N | Chuyển RX thành strafe | <code>RX</code> | <code>ps4.strafePercent()</code> | P0/N |
| D-P10 | Cho phép điều khiển robot (ARM) | S | Yêu cầu ARM, qua neutral check; không tự kích motor | không | <code>robot.requestArm();</code> | P0/N |
| D-P11 | Ngắt điều khiển và dừng (DISARM) | S | Dừng khẩn ở mức chương trình | không | <code>robot.disarm();</code> | P0/N |
| D-P12 | Robot đang được ARM? | B | Đọc trạng thái điều khiển | không | <code>robot.armed()</code> | P0/N |
| D-P13 | Robot gặp lỗi điều khiển? | B | FAULT, không được tự khởi động lại | không | <code>robot.hasFault()</code> | P0/N |
| D-P14 | Xóa lỗi sau khi đã an toàn | S | Reset FAULT theo quy trình neutral+fresh+ready | không | <code>robot.requestClearFault();</code> | P1/N |
| D-P15 | Mã lỗi điều khiển | N | Chẩn đoán fault/link/loop/backend | không | <code>robot.faultCode()</code> | P1/N |
| D-P16 | Tay cầm mất kết nối hơn [250] ms? | B | Chỉ báo timeout; **không thay thế watchdog** | <code>timeout=250ms</code> runtime cố định cho safety | <code>ps4.linkTimedOut()</code> | P1/N |

**Preset điều khiển đã thử được yêu cầu giữ:** cần trái Y tiến/lùi; trái X xoay; cần phải X ngang; Options ARM; Share DISARM; duty đến 100%; LED mất link chớp. Phải giữ semantics **không auto-ARM khi nối lại**, hết freshness phải dừng tải. Mặc định chỉ cho phép đổi mapping sau khi hiểu rõ safety/driver.

**Ghi chú:** bảng này không coi decoder I²C 13 byte legacy ở <code>src/generators/arduino.js</code> là tương thích với adapter I²C sequence-aware ở thư viện <code>CodeLabPs4I2C</code>.

### E. LED, còi và hiển thị

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| E01 | Bật/tắt đèn trên mạch | S | Điều khiển LED được profile định nghĩa | <code>On</code> | <code>digitalWrite(LED_PIN,HIGH);</code> | P0/E (chỉ profile có LED) |
| E02 | Nhấp nháy đèn mỗi [0.5] giây | S | Đèn nhấp nháy | <code>0.5s</code> | <code>digitalWrite(LED_PIN,HIGH); delay(500); digitalWrite(LED_PIN,LOW); delay(500);</code> | P0/E |
| E03 | Bật đèn báo trạng thái PS4 | S | Đèn tự nháy khi mất link, sáng khi kết nối | <code>enabled=true</code>, LED từ profile | <code>robot.setLinkLedEnabled(true);</code> | P0/N |
| E04 | Đặt độ sáng đèn [50]% | S | PWM LED nếu pin và driver hỗ trợ | <code>50%</code> | <code>ui.ledBrightness(50);</code> | P1/H |
| E05 | Hiện lời nhắn [Xin chào!] | S | In Serial Monitor | <code>text="Xin chào!"</code> | <code>Serial.println("Xin chào!");</code> | P0/E |
| E06 | Hiện giá trị [0] không xuống dòng | S | Print giá trị / concat | <code>value=0</code> | <code>Serial.print(value);</code> | P1/E (Advanced) |
| E07 | Phát tiếng bíp trong [0.2] giây | S | Buzzer nếu profile/rail xác minh | <code>duration=0.2s</code> | <code>ui.buzzerBeep(200);</code> | P1/H |
| E08 | Dừng còi | S | Tắt buzzer | không | <code>ui.buzzerOff();</code> | P1/H |

LED GPIO47 dùng trên profile Newmania V1 đã ghi trong main; **V2 GPIO47 là đầu vào driver M6, không phải LED**. Không tạo block LED on-board V2 nếu chưa có mapping riêng.

### F. Servo

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| F01 | Khởi tạo servo [S1] | S (setup) | Chuẩn bị servo, chưa tự phát xung nếu nguồn chưa đạt gate | <code>S1</code> | <code>robot.servoInit(S1);</code> | P2/H |
| F02 | Đặt servo [S1] tới [90] độ | S | Điều khiển góc trong giới hạn đã xác minh | <code>S1</code>, <code>90°</code> | <code>robot.servoSetAngle(S1,90);</code> | P2/G |
| F03 | Đặt tốc độ servo [45] độ/giây | S | Giới hạn tốc độ thay đổi | <code>S1</code>, <code>45°/s</code> | <code>robot.servoRate(S1,45);</code> | P2/H |
| F04 | Tắt tín hiệu servo [S1] | S | Ngắt phát xung điều khiển, không mặc định cắt nguồn | <code>S1</code> | <code>robot.servoDisable(S1);</code> | P2/E (low-level signal disable), H (runtime mới) |
| F05 | Góc đặt cho servo [S1] | N | Giá trị lệnh, **không phải góc thực** nếu thiếu feedback | <code>S1</code> | <code>robot.servoCommandDeg(S1)</code> | P2/N |

**Điều kiện mở servo:** xác minh cấp nguồn, giới hạn cơ khí, loại servo, tín hiệu, power-stable gate, safe startup và phản ứng khi mất kết nối. Không bật servo chỉ vì đã có GPIO và code compile.

### G. Cảm biến và phản hồi

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| G01 | Chân [D1] đang ở mức cao? | B | Digital input qua chân được phép | <code>device=D1</code> (phải cấu hình) | <code>digitalRead(pinOf(D1))==HIGH</code> | P1/E Advanced, H thiết bị |
| G02 | Giá trị analog của [A1] | N | ADC nguyên 0..4095 | <code>device=A1</code> | <code>analogRead(pinOf(A1))</code> | P1/E Advanced, theo board |
| G03 | Khởi tạo cảm biến khoảng cách [Khoảng cách 1] | S (setup) | Khởi tạo module siêu âm/tof | <code>device=Distance1</code> | <code>sensors.beginDistance(Distance1);</code> | P1/H |
| G04 | Khoảng cách đo được (cm) | N | Đọc số cm, có trạng thái invalid | <code>Distance1</code> | <code>sensors.distanceCm(Distance1)</code> | P1/H |
| G05 | Có vật cản gần hơn [20] cm? | B | So sánh có xử lý timeout | <code>Distance1</code>, <code>20cm</code> | <code>sensors.obstacleCloserThan(Distance1,20)</code> | P1/H |
| G06 | Cảm biến dò vạch [L1] thấy vạch? | B | Tín hiệu đường line đã hiệu chuẩn | <code>Line1</code> | <code>sensors.onLine(Line1)</code> | P1/H |
| G07 | Cảm biến [Button1] được nhấn? | B | Nút vật lý cấu hình pull | <code>Button1</code> | <code>sensors.buttonPressed(Button1)</code> | P1/H |
| G08 | Cảm biến màu phát hiện [đỏ]? | B | Nhận màu khi có driver/calibration | <code>Color1</code>, <code>Red</code> | <code>sensors.isColor(Color1,Red)</code> | P2/H |
| G09 | Cường độ màu [đỏ] | N | Đọc 1 kênh RGB | <code>Color1</code>, <code>Red</code> | <code>sensors.colorChannel(Color1,Red)</code> | P2/H |
| G10 | Khởi tạo IMU | S (setup) | IMU theo profile, ví dụ V2 địa chỉ I²C 0x6A | <code>IMU1</code> | <code>sensors.beginImu(IMU1);</code> | P2/H |
| G11 | Góc quay robot (yaw, độ) | N | Góc có drift/reset, không giả định tuyệt đối | <code>IMU1</code> | <code>sensors.yawDeg(IMU1)</code> | P2/H |
| G12 | Độ nghiêng [pitch] (độ) | N | Orientation | <code>IMU1</code>, <code>Pitch</code> | <code>sensors.angleDeg(IMU1,Pitch)</code> | P2/H |
| G13 | Số xung encoder [E1] | N | Bộ đếm xung có phần cứng hỗ trợ | <code>E1</code> | <code>sensors.encoderTicks(E1)</code> | P2/H |
| G14 | Đặt bộ đếm encoder [E1] về 0 | S | Reset tương đối | <code>E1</code> | <code>sensors.resetEncoder(E1);</code> | P2/H |
| G15 | Cảm biến [S1] có dữ liệu hợp lệ? | B | Không dùng giá trị cũ khi cảm biến timeout | <code>sensor=S1</code> | <code>sensors.valid(S1)</code> | P1/N |

Không kết luận tất cả những cảm biến này đã được lắp vào board. Trong profile hiện tại, V2 có **hai encoder và IMU ở mức thông tin chân**, chưa đồng nghĩa đã có driver/đã thử trên hardware. Cảm biến siêu âm/màu/dò vạch là module tùy chọn.

### H. Logic, phép toán và giá trị số

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| H01 | Đúng / Sai | B | Hằng bool | <code>false</code> | <code>false</code> | P0/E |
| H02 | [1] [=] [1] | B | So sánh =, ≠, &lt;, ≤, &gt;, ≥ | <code>A=1</code>, <code>op==</code>, <code>B=1</code> | <code>(A == B)</code> | P0/E |
| H03 | [đúng] và [đúng] | B | AND/OR | <code>true AND true</code> | <code>(a &amp;&amp; b)</code> | P0/E |
| H04 | Không [đúng] | B | NOT | <code>true</code> | <code>!a</code> | P0/E |
| H05 | Số [0] | N | Hằng số | <code>0</code> | <code>0</code> | P0/E |
| H06 | [1] + [1] | N | + − × ÷ | <code>1+1</code> | <code>(a+b)</code> | P0/E |
| H07 | Số dư [10] chia [3] | N | Chia lấy dư, xử lý chia 0 | <code>10,3</code> | <code>codelabModulo(10,3)</code> | P0/E |
| H08 | Số ngẫu nhiên từ [1] đến [10] | N | Random nguyên, bao gồm hai đầu | <code>1,10</code> | <code>codelabRandom(1,10)</code> | P0/E |
| H09 | Giá trị tuyệt đối của [-5] | N | abs | <code>-5</code> | <code>fabs(-5)</code> | P0/E |
| H10 | Làm tròn [3.5] | N | Round/floor/ceil | <code>3.5</code>, <code>Round</code> | <code>round(3.5)</code> | P1/E |
| H11 | Giới hạn [50] từ [0] đến [100] | N | Clamp | <code>50,0,100</code> | <code>codelabClamp(50,0,100)</code> | P0/E |
| H12 | Đổi thang [50] từ [-100..100] sang [-255..255] | N | Linear mapping, có kiểm tra mẫu số | <code>50,-100,100,-255,255</code> | <code>robot.mapRange(50,-100,100,-255,255)</code> | P1/N |
| H13 | Chọn giá trị nhỏ nhất/lớn nhất | N | Min/Max | <code>A=1</code>, <code>B=2</code> | <code>fmin(a,b)</code> / <code>fmax(a,b)</code> | P1/N |
| H14 | Trị sin/cos của [0] độ | N | Toán góc | <code>0°</code> | <code>sin(degToRad(0))</code> | P2/N |

Với khối chia, random, loop: không lặp đánh giá lại biểu thức ngẫu nhiên ngoài ý muốn; xử lý NaN, chia 0, giới hạn số lần lặp và cấp tài nguyên trong generator.

### I. Biến, văn bản và dữ liệu

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| I01 | Tạo biến [điểm] | D/UI | Tên biến và phạm vi | <code>name="điểm"</code>, kiểu suy luận | ví dụ <code>double diem=0;</code> | P0/E |
| I02 | Đặt [điểm] thành [0] | S | Gán biến | <code>điểm=0</code> | <code>diem=0;</code> | P0/E |
| I03 | Thay đổi [điểm] một lượng [1] | S | Cộng vào biến | <code>điểm+=1</code> | <code>diem+=1;</code> | P0/E |
| I04 | Giá trị biến [điểm] | N/T/B | Đọc biến đã định kiểu | <code>điểm</code> | <code>diem</code> | P0/E |
| I05 | Chuỗi chữ [Xin chào!] | T | Hằng chuỗi | <code>"Xin chào!"</code> | <code>String("Xin chào!")</code> | P0/E |
| I06 | Ghép chữ [A] với [B] | T | Concat | <code>A="A", B="B"</code> | <code>(String(a)+String(b))</code> | P0/E |
| I07 | Độ dài văn bản [abc] | N | Length | <code>text="abc"</code> | <code>String(text).length()</code> | P1/N |
| I08 | Tạo danh sách [Giá trị] | D/UI | Khai báo list có kiểu/phạm vi | <code>list=[]</code> | <code>std::vector&lt;double&gt; values;</code> hoặc buffer giới hạn | P2/N |
| I09 | Thêm [0] vào danh sách [Giá trị] | S | Append | <code>value=0</code> | <code>values.push_back(0);</code> | P2/N |
| I10 | Phần tử thứ [1] của danh sách | N | Đọc có kiểm tra index | <code>index=1</code> (học sinh đánh số 1) | <code>robot.listGet(values,1)</code> | P2/N |

Nếu dùng danh sách trên ESP32, phải chốt dung lượng và chính sách lỗi; không tạo vector tăng vô hạn từ block học sinh.

### J. Khối tự tạo (My Blocks)

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| J01 | Định nghĩa [chạy robot] | H/định nghĩa | Định nghĩa hàm tái sử dụng | <code>name="chạy robot"</code>, không tham số | <code>void chayRobot(){...}</code> | P1/E (Advanced), hoàn thiện Basic |
| J02 | Gọi [chạy robot] | S | Gọi hàm | không | <code>chayRobot();</code> | P1/E (Advanced) |
| J03 | Định nghĩa hàm [quay] nhận [tốc độ] | H/định nghĩa | Hàm có tham số | <code>speed=30</code> | <code>void quay(double speed){...}</code> | P1/N (generator cần test) |
| J04 | Gọi hàm [quay] với [30] | S | Truyền tham số | <code>30</code> | <code>quay(30);</code> | P1/N (generator cần test) |

### K. Nâng cao (Advanced) — không phơi bày cho học sinh mới

| ID | Block | Loại | Chức năng | Tham số (mặc định) | C++ sinh ra / runtime call | Ưu tiên / hiện trạng |
|---|---|---|---|---|---|---|
| K01 | Đọc GPIO [1] | B | Digital input | <code>pin=1</code> | <code>digitalRead(1)==HIGH</code> | P1/E |
| K02 | Ghi GPIO [1] [LOW] | S | Digital output | <code>pin=1</code>, LOW | <code>digitalWrite(1,LOW);</code> | P1/E |
| K03 | Đọc Analog GPIO [2] | N | ADC | <code>pin=2</code> | <code>analogRead(2)</code> | P1/E |
| K04 | PWM GPIO [47] duty [0] | S | PWM pin dùng khi profile cho phép | <code>pin=47</code>, duty=0/255 | <code>ledcWrite(47,0);</code> (setup ledcAttach) | P1/E |
| K05 | Đọc Serial có dữ liệu? | B | Serial RX buffer | không | <code>Serial.available()&gt;0</code> | P1/E |
| K06 | Đọc ký tự Serial | N | Serial byte | không | <code>Serial.read()</code> | P1/E |
| K07 | Ghi Serial [hello] | S | Print/println | <code>"hello"</code> | <code>Serial.println("hello");</code> | P1/E |
| K08 | Cấu hình UART PS4 | S | Adapter legacy nếu profile có, không thay I2C thật | RX/TX theo profile, baud 115200 | <code>Serial1.begin(115200,SERIAL_8N1,rx,tx);</code> | P2/M |
| K09 | Cấu hình I²C nâng cao | S | Bus và địa chỉ thiết bị do giáo viên cấu hình | SDA8, SCL9, addr0x30 nhưng cần profile phù hợp | <code>Wire.begin(8,9);</code> | P2/N |
| K10 | Đọc byte I²C từ [0x30] | N | Giao tiếp raw, kiểm tra timeout | <code>addr=0x30</code>, len=1 | <code>bus.readByte(0x30)</code> | P2/N |
| K11 | Ghi byte I²C tới [0x30] | S | Giao tiếp raw, conflict với PS4 nếu trùng địa chỉ | addr0x30, value0 | <code>bus.writeByte(0x30,0);</code> | P2/N |
| K12 | Đặt chế độ GPIO [INPUT_PULLUP] | S | Pull input | <code>pin=1</code>, <code>INPUT_PULLUP</code> | <code>pinMode(1,INPUT_PULLUP);</code> | P1/E |

**Không cho raw GPIO hoặc I²C nâng cao chiếm chân motor, USB, I²C PS4, bộ nhớ flash/PSRAM hoặc boot straps theo profile.**

## 3. Hợp đồng C++ đề xuất để các block cùng dùng một backend

Các tên dưới đây **chưa tồn tại đầy đủ**. Đây là chuẩn API **đề xuất** cần duyệt trước khi viết wrapper/generator. API có thể đổi tên khi implement nhưng **không thay ngữ nghĩa block đã duyệt**.

~~~cpp
#include <Arduino.h>
#include <CodeLabRuntime.h>  // DE XUAT: chua co trong main

using namespace codelab;

CodeLabRuntime robot;
Ps4Controller ps4;
SensorManager sensors;
OutputManager ui;

// Enum proposed: M1..M6, FL/FR/RL/RR, Forward/Reverse,
// Left/Right, X/Options/Share, LX/LY/RX/RY, ...

void setup() {
  Serial.begin(115200);
  RobotConfig cfg = profileConfig(/* boardId tu metadata project */);
  // Cấu hình Devices được sinh ở đây, không nhúng GPIO tùy ý trong block.
  robot.begin(cfg);                       // startup SAFE/DISARMED
  robot.initMotor(M1);
  robot.initMotor(M2);
  robot.initMotor(M3);
  robot.initMotor(M4);
  robot.initDrive(Mecanum4);             // FL/FR/RL/RR từ Devices
  ps4.beginI2c(8, 9, 0x30);             // chỉ profile đã được chấp thuận
  robot.setLinkLedEnabled(true);
}

void loop() {
  // ĐỀ XUẤT: runtime tiến trình an toàn độc lập (không chỉ dựa vào loop).
  robot.poll();
  ps4.poll();

  if (ps4.justPressed(Options)) robot.requestArm();
  if (ps4.pressed(Share)) robot.disarm();

  if (ps4.connected() && robot.armed()) {
    // X trái xoay; Y trái tiến/lùi; X phải ngang.
    robot.drive(ps4.forwardPercent(),
                ps4.strafePercent(),
                ps4.turnPercent());
  } else {
    robot.driveStop();
  }
  delay(1);
}
~~~

**Mẫu này là sơ đồ contract, KHÔNG được dùng như code flash trực tiếp.** Firmware motor hiện có sử dụng <code>codelab::robot::RobotController</code>, <code>MecanumMixer</code>, <code>Ps4ControlMapping</code> và các lớp MCPWM ứng với demo local. Codex phải viết adapter bọc chúng, không triển khai lại truth table một cách độc lập nếu chưa cần.

### Safety/API contract bắt buộc

1. Mọi lệnh <code>motorRun</code>, <code>motorSetPower</code>, <code>drive</code>, <code>servoSetAngle</code> phải qua trạng thái <code>ARMED</code>, cấu hình đúng kênh và driver ready; mặc định khởi động **0 PWM/DISARMED**.
2. Không cho một motor vừa nhận lệnh từ nhóm/drivetrain vừa bị một lệnh độc lập ghi đè ngẫu nhiên. Chọn arbitration model rõ (ví dụ ownership theo chu kỳ hoặc cấm tạo xung đột khi compile).
3. Poll PS4 I²C phải kiểm tra **sequence + freshness**; mã nguồn chưa kiểm chứng không được làm mới thời gian chỉ vì I²C request thành công. Mất link/loop stall (mốc hiện dùng khoảng 250ms) phải đưa motor về 0 và FAULT theo cấu hình.
4. Safety motor phải hoạt động ngay cả khi block học sinh đợi/lặp lâu; có thể dùng task/timer độc lập và lease/heartbeat an toàn; **chưa có trên main**, cần thiết kế/kiểm chứng. Không tuyên bố <code>delay(1)</code> trong vòng lặp học sinh là giải pháp bảo vệ đủ.
5. Options yêu cầu ARM ở trung tính; Share DISARM; reconnect không auto-ARM; clear lỗi cần lệnh riêng theo chính sách recovery; **không để student block bypass**.
6. Công suất công bố 0..100% là duty yêu cầu, không phải vận tốc đo; các block vị trí, dòng, hold phải ẩn/chặn nếu chưa có phản hồi phần cứng.
7. Đừng đưa servo, IMU, encoder hay M5/M6 V2 vào trạng thái "đã chạy" vì chỉ có dữ liệu pin.
8. Mọi API C++ được sinh phải có test golden code + host/unit tests + compile đúng target, sau đó mới hardware bench (nếu cần) mới bật upload.

## 4. Ba chương trình mẫu bắt buộc sau khi chốt block

### L1. Điều khiển một motor bằng nút X (đầu tiên cần làm)

Blockly:
~~~text
Khi bắt đầu chương trình
  Khởi tạo động cơ [M1]
  Kết nối tay cầm PS4

Lặp lại mãi mãi
  Nếu nút [Options] vừa nhấn: yêu cầu ARM
  Nếu nút [Share] đang nhấn: DISARM
  Nếu PS4 đã kết nối VÀ Robot đã ARM
    Nếu nút [X] đang được nhấn
      Động cơ [M1] quay [tiến] tốc độ [50]%
    Nếu không
      Dừng động cơ [M1]
  Nếu không
    Dừng tất cả động cơ
~~~

C++ chính trong <code>loop()</code>:
~~~cpp
if (ps4.justPressed(Options)) robot.requestArm();
if (ps4.pressed(Share)) robot.disarm();
if (ps4.connected() && robot.armed()) {
  if (ps4.pressed(X)) robot.motorRun(M1, Forward, 50);
  else robot.motorStop(M1);
} else robot.stopAllMotors();
~~~

### L2. Hai motor và điều kiện trái/phải

Blockly:
~~~text
Khi bắt đầu: khởi tạo M1, M2; kết nối PS4
Lặp mãi mãi (sau khi ARM):
  Nếu cần trái ngang > 20
    M1 tiến 40%; M2 lùi 40%
  Nếu không nếu cần trái ngang < -20
    M1 lùi 40%; M2 tiến 40%
  Nếu không
    Dừng M1; dừng M2
~~~

**Bắt buộc kèm safety/ARM và không gán ý nghĩa "xoay robot" nếu 2 motor chưa được đặt đúng vị trí cơ khí.**

### L3. Mecanum 4 bánh, tùy chỉnh từng khối

Blockly:
~~~text
Khi bắt đầu:
  Khởi tạo M1 / M2 / M3 / M4
  Khởi tạo robot 4 bánh mecanum theo Devices
  Kết nối PS4 I2C
  Bật đèn báo mất kết nối

Lặp mãi mãi:
  Nếu Options vừa nhấn: yêu cầu ARM
  Nếu Share đang nhấn: DISARM
  Nếu PS4 đã kết nối VÀ Robot đã ARM
    Di chuyển theo:
      tiến = cần trái dọc
      ngang = cần phải ngang
      xoay = cần trái ngang
  Nếu không: Dừng robot
~~~

Mỗi lệnh là block **tháo/sửa được**; không khóa toàn bộ vào "Điều khiển robot bằng PS4" duy nhất. Preset fast100 chỉ là bài mẫu, không phải kiến trúc generator độc nhất.

## 5. Hiện trạng trên main đối chiếu với danh mục

| Đã có và giữ lại | Mới cần phát triển | Chờ nghiệm thu phần cứng |
|---|---|---|
| Blockly workspace, custom renderer/theme, categories, 2 modes; các khối bắt đầu/lặp/if/logic/toán/biến, LED, Serial; 5 bài mẫu; project local JSON; generator C++ | Devices editor; Basic motor init/run/stop; drivetrain; PS4 I²C đúng protocol; joystick phải; ARM/FAULT block; event edge; nhóm motor; các bài L1–L3; runtime facade/generator/safety scheduler | V1 board thực được nhận đúng profile; driver V2 M1–M6; servo signal/power; cảm biến siêu âm/color/line; IMU/encoder feedback; chế độ brake/position/current |
| PS4 mô phỏng và legacy UART/13-byte I²C adapter | Chuyển generator sang CodeLabPs4I2C sequence-aware mà không phá legacy workspace | Kiểm thử PS4 disconnect/reconnect, PWM/directions, mất nguồn và bảo vệ lỗi trên phần cứng |

Các file ưu tiên khi triển khai: 
- <code>src/blocks/beginner.js</code>, <code>src/blocks/beginner-toolbox.js</code>, <code>src/blocks/controller.js</code>, <code>src/blocks/robotics.js</code>, <code>src/boards/profiles.js</code>, <code>src/generators/arduino.js</code>.
- <code>src/App.jsx</code> và <code>src/components/BlocklyWorkspace.jsx</code> (Devices UI, block categories/defaults, lưu project).
- <code>firmware/libraries/CodeLabRobot</code>, <code>firmware/libraries/CodeLabPs4I2C</code>, motor backend đã kiểm chứng trong workspace local.
- <code>tests/{beginner,robotics,i2c,mecanum,bridge}.test.mjs</code> và ba lesson mới.

**Không** sửa compile/upload/WASM trong sprint chốt block. PoC trình duyệt độc lập theo Issue #27 và nhánh <code>experiment/browser-wasm-mvp</code> là phase sau.

## 6. Checklist cần chủ sản phẩm duyệt trước khi code

- [ ] Chọn nhóm bắt buộc ban đầu: A+B+C+D+E cơ bản+H+I, chưa cần servo/cảm biến mở rộng?
- [ ] Devices có tên motor, đảo chiều, role và group **riêng**; block "Khởi tạo motor" là thao tác dạy học, không nhập GPIO?
- [ ] Tốc độ block dùng phần trăm công suất, **không hứa RPM**; giới hạn 100% chỉ cho profile đã được xác minh?
- [ ] PS4 preset chính: trái Y tiến/lùi, trái X xoay, phải X ngang; Options ARM, Share DISARM?
- [ ] Có hai chế độ: Basic thấy block thực tế cần dùng; Advanced có GPIO/Serial/bus nhưng bị kiểm soát xung đột?
- [ ] Các block Event/My Blocks có cần hoàn thành ngay hay P1 sau lesson motor đầu tiên?
- [ ] Sensor nào thật sự có trong kit mục tiêu? Chốt driver/cổng và thứ tự (ultrasonic/color/line/IMU/encoder).
- [ ] Servo chỉ hiện như preview và vẫn chặn tải cho tới khi gate nguồn/driver pass?
- [ ] Bài mẫu L1–L3 bắt buộc phải chỉnh được từng block và có file project JSON cùng golden sketch?
- [ ] Cho phép bắt đầu implement khi tài liệu và ma trận profile/runtime được duyệt, không đụng các chức năng khác?

## 7. Định nghĩa Done của phần block trước khi tích hợp WASM

1. Dùng Blockly kéo thả tạo L1–L3; **không viết C++ thủ công** và không cần một block auto-drive đóng kín.
2. Generator tạo C++ đầy đủ và có thể compile trên cấu hình đã xác minh; không chỉ trình bày ví dụ API tưởng tượng.
3. Nút X/motor, PS4 thật và mecanum hoạt động ở bench khi có xác nhận thực nghiệm; V2 chưa nghiệm thu được báo blocked rõ ràng.
4. Legacy projects load/save/board switch/mode switch giữ dữ liệu và không remap kênh; test nested if/else, event edge, duplicate device, conflict owner.
5. <code>npm test</code>, <code>npm run build</code>, Arduino compile example PASS (sẽ chạy lúc implement), hardware test không được nói PASS nếu chưa làm.
6. Chỉ khi phần Blockly đạt gate mới triển khai WASM cho browser-only compiler; **không cần máy học sinh cài CLI, không cài firmware trung gian** là mục tiêu của phase đó, không phải trạng thái hiện tại.

## 8. Nguồn đối chiếu

- CodeLab Issue Blockly ưu tiên: https://github.com/HiyoriVn/CodeLab/issues/28
- PoC WASM plan: https://github.com/HiyoriVn/CodeLab/issues/27
- VEX IQ — Configuring Smart Motors: https://kb.vex.com/hc/en-us/articles/360035953011
- VEX IQ — Controller / Devices: https://kb.vex.com/hc/en-us/articles/4407063155732
- VEX IQ 2nd Gen Motor Blocks: https://api.vex.com/iq2/home/blocks/Motion/motors.html
- CodeLab source: https://github.com/HiyoriVn/CodeLab/tree/main

**Chú ý:** VEX IQ dùng Smart Motor tích hợp cảm biến; CodeLab motor DC + PWM của board hiện tại không tự có chức năng phản hồi RPM, góc hay dòng. Các block tương ứng trong tài liệu là dự kiến tương lai, không được bật giả.
