# Robot mecanum 4 bánh bằng PS4

## Khởi chạy trên Windows

Trong PowerShell, tại thư mục CodeLab, dùng Arduino CLI 1.5.1 và ESP32 core 3.3.7 đã cài. Nếu CLI chưa có trong PATH, đặt đường dẫn phù hợp với máy. Ví dụ với bản Arduino IDE cài theo tài khoản Windows:

```powershell
$env:ARDUINO_CLI_PATH = Join-Path $env:LOCALAPPDATA 'Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA = Join-Path $env:LOCALAPPDATA 'Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS = Join-Path $env:ARDUINO_DIRECTORIES_DATA 'staging'
npm run build
npm run bridge
```

1. Mở [CodeLab cục bộ](http://127.0.0.1:8787). Trong **Bài mẫu**, chọn **Robot mecanum 4 bánh bằng PS4**. Bài tự chọn profile **Newmania 4WD fast100 (16 MB, PSRAM tắt)**.
2. Kéo khối trong nhóm **Robot PS4**. Đặt **Khởi tạo robot 4 bánh**, **Kết nối PS4 qua I2C**, và tùy chọn tốc độ hoặc đèn trong **Khi bắt đầu**. Đặt **Điều khiển robot bằng PS4** trong **Lặp lại mãi mãi**. Có thể dùng **PS4 đã kết nối?** với **nếu** để chọn lệnh di chuyển.
3. Mở **Thiết bị** → **Biên dịch**. Bridge dùng `CodeLabFast4wd`, `CodeLabRobot` và `CodeLabPs4I2C` trong repository. Lỗi từ Arduino CLI hiện ngay trong hộp thoại. Sau khi đổi code hoặc board, biên dịch lại.
4. Sau khi xác minh phần cứng theo mục dưới và ngắt nguồn motor, chọn cổng USB gốc của **S3**. Rút/cắm lại cáp **S3** và bấm **Làm mới cổng** để đối chiếu cổng nếu cần. Tick xác nhận phần cứng, bấm **Nạp lên bo mạch…** và kiểm tra COM trong hộp xác nhận cuối. CodeLab đóng Bảng lệnh khi mở hộp **Thiết bị**. Đóng thêm Serial Monitor của Arduino IDE hoặc ứng dụng khác đang giữ cổng.
5. Sau khi nạp, chọn **Mở Bảng lệnh** → **Chọn cổng & kết nối** trong Chrome hoặc Edge, chọn cổng S3 và baud **115200**. Runtime báo trạng thái I2C/MCPWM khi khởi động, sau đó in trạng thái kết nối, ARM/FAULT và số báo cáo I2C mỗi giây.

Build và upload dùng bridge tại loopback. Bảng lệnh dùng Web Serial. Để biên dịch ba bài fast100 qua đúng endpoint của web mà không dùng bo, chạy `node tools/verify-fast4wd-build.mjs` với cùng biến môi trường. Bridge cho build fast100 tối đa sáu phút mỗi bài để phục vụ lần biên dịch chưa có cache.

## Tự viết chương trình với Cấu hình robot

Mở **Cấu hình robot** ở thanh chọn board. Đặt tên, cổng, chiều và trạng thái bật của từng motor. Với drivetrain mecanum, gán bốn motor riêng biệt theo vị trí trước trái/phải và sau trái/phải. Giới hạn PWM cũng áp dụng cho lệnh motor riêng. CodeLab lưu cấu hình theo từng profile trong dự án, giữ tham chiếu khối khi đổi tên và báo lỗi khi motor đang dùng bị tắt. Khi mở dự án cũ chưa có cấu hình robot, các khối thiết lập cũ vẫn hoạt động.

- **Tự lập trình mecanum bằng PS4** dùng `if/else` trong **Lặp lại mãi mãi** và ba khối đọc trục riêng. Kéo một trục ra khỏi khối mecanum để thử chạy riêng các trục còn lại. Bài này cho phép trộn ba trục cùng lúc. Bài fast100 gốc vẫn dùng ưu tiên xoay.
- **PS4 điều khiển từng motor** dùng sự kiện nhấn/thả X. Hai lệnh chạy motor theo thời gian minh họa **không chờ** và **có chờ**. Khi có chờ, các stack Blockly khác tạm hoãn; cạnh nút đi qua trong lúc chờ không được phát lại. I2C, Share và watchdog vẫn chạy.
- **Mẫu cấu hình mecanum** mở workspace trống với cấu hình bánh và PS4 sẵn. Trong **Hướng dẫn → Help các khối cấu hình robot**, mỗi khối có mô tả. Tham khảo thêm tooltip trực tiếp trên khối.

Khối PWM motor phản ánh mức điều khiển đã áp dụng theo chiều cấu hình. CodeLab chưa có phép đo vận tốc hay vị trí. Các lệnh motor riêng giữ quyền điều khiển cổng cho đến khi dùng **Trả motor về drivetrain**, hoặc mất ARM. Dừng motor và hết thời gian đặt PWM về 0; mất link hoặc Share xóa các lệnh motor và bộ hẹn giờ.

V1 N8R2 có bốn cổng và V2 có sáu cổng để cấu hình theo mapping đã biết. Các khối motor trên hai profile này báo chặn sinh firmware vì PWM vật lý chưa được xác minh. Profile OPI không cung cấp cổng motor. [Thiết kế và đối chiếu VEXcode IQ](DEVICE_CONFIGURATION_DESIGN.md)

## Điều kiện phần cứng

| Hạng mục | fast100 |
| --- | --- |
| D1 nhận PS4 qua Bluetooth | I2C slave `0x30`, SDA22, SCL21, firmware D1 gửi frame CodeLab 13 byte có sequence |
| S3 | I2C master SDA8/SCL9, 100 kHz, chung GND với D1, tín hiệu 3,3 V |
| Bốn kênh motor | M1 35/36, M2 37/38, M3 39/40, M4 41/42, MCPWM 1.000 Hz |
| LED | GPIO47, sáng khi link còn mới, đổi mức mỗi 250 ms khi mất link |
| FQBN | `esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=disabled,USBMode=hwcdc,CDCOnBoot=cdc` |

Chỉ dùng profile này trên PCB đã kiểm chứng đúng sơ đồ fast100 và GPIO35–37 rảnh khỏi flash/PSRAM. Trên N16R8/Octal, các GPIO này có thể nối bộ nhớ ngay trong module. Menu `PSRAM=disabled` không chứng minh đường mạch rảnh. Cổng VID/PID `303A:1001` lọc bộ USB–UART của D1 nhưng được chia sẻ giữa các chip Espressif, nên vẫn phải xác nhận bo và cổng. Runtime từ chối khởi tạo GPIO khi flash khác 16 MB, phát hiện PSRAM tích hợp/đang chạy, hoặc eFuse flash báo Octal hay không đọc được. Kiểm tra này không xác minh được sơ đồ PCB hay loại bộ nhớ ngoài. [Hướng dẫn chân GPIO của Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/gpio.html)

## Điều khiển

- Bấm **Options** khi cần ở giữa để ARM. Bấm **Share** hoặc chạy khối **Dừng robot** để DISARM và đưa PWM về 0. Sau mất link, Options ở vị trí giữa có thể xóa lỗi LINK rồi ARM ở tick sau. Giữ Options khi kết nối lại không ARM.
- Cần trái Y tiến/lùi, cần trái X xoay, cần phải X đi ngang. Giữ ngưỡng ưu tiên xoay của fast100. Cần phải Y không tham gia điều khiển. M1/M2 đảo chiều so với M3/M4. Bài mẫu đặt giới hạn PWM 100% và cho phép sửa trong khoảng 1–100%.
- Các khối tiến/lùi, ngang và xoay yêu cầu một hướng tại giới hạn tốc độ đã chọn, trong lượt lặp hiện tại và chỉ khi robot đã ARM, còn link. Nếu có nhiều lệnh di chuyển trong cùng lượt, lệnh cuối có hiệu lực. Khối dừng ưu tiên hơn mọi lệnh di chuyển. Khi không có lệnh trong lượt, runtime giảm tốc về 0 theo ramp.
- Khi report không còn hợp lệ, motor dừng. Poll I2C lặp lại không làm mới báo cáo. Watchdog hết hạn khi quá 250 ms không có report mới. Toolbox 4WD chỉ cho phép điều kiện hữu hạn trong loop để tiếp tục phục vụ watchdog. Servo vật lý chưa được hỗ trợ.

## Nguồn và kiểm tra

Driver MCPWM và cấu hình điều khiển lấy từ sketch local `firmware/demos/newmania_ps4_4wd_fast100/newmania_ps4_4wd_fast100.ino` và ba header cùng thư mục, theo xác nhận của chủ dự án rằng bản đó đã chạy trên phần cứng. SHA-256 của sketch baseline là `FE6AB9590CBDE0A61F35552971A3FB09D9BD7B167A75ABB574FEF530B37D95E9`. Các demo local và cầu D1 giữ nguyên. Runtime Blockly thêm cổng kiểm tra bộ nhớ, chế độ lệnh Blockly và bỏ qua cần phải Y cả khi kiểm tra trung tính.

- `npm test` đạt 65/65. Host test dùng runtime C++ và driver MCPWM thật với phần cứng mô phỏng. Kiểm tra pin/timer, duty và chiều, Options/Share, stop, reconnect, watchdog 250/251 ms và LED.
- `npm run build` đạt. Smoke test Chrome với bridge giả lập xác nhận bài mẫu sinh C++, UI hiển thị lỗi compile, lọc D1, khóa nút nạp đến khi chọn COM và tick xác nhận, và hiển thị hộp xác nhận cuối. Nhánh nạp được kiểm tra bằng HTTP với CLI giả lập.
- Arduino CLI 1.5.1 / ESP32 core 3.3.7 biên dịch bài Blockly qua `/api/compile` thành binary 346.640 byte. Kết quả phần cứng cho bản tích hợp vẫn chờ xác nhận bo và lần nạp riêng khi đã ngắt nguồn motor.
