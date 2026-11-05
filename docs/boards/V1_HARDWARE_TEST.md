# Newmania Starter V1.0 — chuẩn bị hardware testing

Trạng thái: **SOFTWARE_ACCEPTED** cho phạm vi ví dụ I/O an toàn và luồng compile đã kiểm tra; **HARDWARE_UNTESTED** cho USB/PSRAM/đầu ra thật. V1 là board kiểm thử, V2 là board mục tiêu; không thay native V2 và không có MotorDriver/ServoDriver/PS4Bridge mới. [Profile và nguồn pinout](BOARD_PROFILES.md), [kết quả kiểm tra](../verification/NEWMANIA_V1_FAST_TRACK.md).

## Chạy phần mềm trên Windows

Dùng các công cụ đã cài, không cập nhật core hoặc cấu hình IDE. Trong một PowerShell mới tại workspace:

```powershell
$env:ARDUINO_CLI_PATH='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS='C:\Users\Admin\AppData\Local\Arduino15\staging'
npm run build
npm run bridge
```

Mở `http://127.0.0.1:8787`. Nếu phát triển bằng Vite, chạy `npm run dev` ở PowerShell thứ hai, dùng port5173 (origin bridge còn giới hạn 5173/4173/8787). Bridge cần được launch từ process có các biến trên. Nếu compiler báo lỗi DLL trong Codex sandbox, chạy đúng command được cho phép ngoài sandbox; không cài lại core để né lỗi.

Chọn **Newmania Starter V1.0 (test board)** ở thanh Board. Import một file `.codelab.json` dưới `firmware/newmania_v1/examples/` qua **Tập tin**. Xem code/warnings; vào **Thiết bị → Biên dịch**. Compile không nạp code, không chọn COM. Thành công chỉ cho phép bước nạp riêng sau đó.

Khi bạn chủ động kiểm thử board thật: chọn đúng cổng đã xác nhận của V1 trong dropdown và dùng nút **Nạp lên bo mạch…**, đọc tên board/cổng rồi xác nhận. Đóng Serial Monitor trước upload; mở lại **Bảng lệnh** và tự chọn cổng, baud115200 sau upload. App dùng Web Serial ở browser hỗ trợ; việc đóng panel ngắt cổng và bỏ log hiển thị. Không có thao tác nạp tự động trong ví dụ hoặc build script.

## Ví dụ đã chuẩn bị

| Ví dụ | File trong `firmware/newmania_v1/examples/` | Kỳ vọng khi chủ động nạp ở bước hardware |
|---|---|---|
| Minimal | `minimal/minimal.ino`, JSON cùng tên | Giữ motor/buzzer LOW, servo Hi-Z, mở Serial; không PWM hoặc hoạt động tải |
| LED Blink | `blink/blink.ino`, JSON | LED47 HIGH/LOW, 500 ms mỗi mức; không dùng LED power làm kết quả |
| Serial Hello | `serial_hello/serial_hello.ino`, JSON | Hello, Newmania! mỗi 1000 ms, 115200 baud |
| Digital Input | `digital_input/digital_input.ino`, JSON | GPIO1 INPUT; in Boolean mỗi 250 ms; cần mức tín hiệu ngoài đã xác nhận |
| ADC Read | `adc_read/adc_read.ino`, JSON | GPIO1 input ADC; in raw mỗi 250 ms; không đo khi floating |
| PWM LED | `pwm_led/pwm_led.ino`, JSON | LED47 PWM 5 kHz/8-bit duty32; không gọi servo/motor |

Mỗi `.ino` độc lập đã có startup inhibit từ cùng profile renderer. `newmania_v1.ino` ở thư mục gốc là biến thể minimal của profile. Muốn dùng GPIO khác phải kiểm tra profile/wiring rồi sửa block rõ ràng; không remap tự động. GPIO3 có ADC trong tài liệu nhưng là strapping nên hiện chặn; GPIO16 là lựa chọn ADC mở rộng không strapping.

## Hardware checklist — tất cả hiện chưa thực hiện

- [ ] Nhận diện đúng PCB Newmania Starter **V1.0**, module **ESP32-S3-WROOM-1-N8R2**, chụp marking/USB và ghi revision.
- [ ] Rút motor/servo khỏi board trước các bài kiểm thử này; kiểm tra dây/tải đang nối trên GPIO47 và GPIO1. Đối chiếu GND, tín hiệu 3.3 V và pin connector bằng tài liệu/đo kiểm; không mặc định cổng cấp5V có signal chịu5V.
- [ ] Bắt đầu với USB-C cho thử phần điều khiển; không cấp DC3–15V cho motor3–6V khi chưa kiểm tra đường cấp motor/điện áp thực tế. Không dùng tuyên bố nguồn board để suy ra áp an toàn tải.
- [ ] Xác định USB đi native CDC hay qua bridge; profile hiện candidate hardwareCDC + CDCOnBoot enabled. Ghi VID/PID/COM/browser/OS/cáp; nếu khác, dừng và ghi nhu cầu đổi profile, không thay core tùy ý.
- [ ] Tự compile minimal và review target; chủ động chọn cổng và xác nhận upload. Ghi kết quả/reset/boot, bảo đảm không chuyển động, không xung servo. Đo mức motor/buzzer và servo Hi-Z nếu có dụng cụ; software không bảo đảm trạng thái trước CPU init.
- [ ] Kiểm tra thông tin flash8MB và PSRAM2MB QSPI trên thiết bị bằng công cụ/diagnostic được giao riêng; build `PSRAM=enabled` không chứng minh chip runtime sử dụng được PSRAM.
- [ ] Nạp Blink theo thao tác explicit; xác nhận đúng LED47, chu kỳ và reset. Không bật motor/servo/buzzer để minh họa.
- [ ] Nạp Serial Hello; tự mở cổng115200, ghi dòng nhận/read/disconnect/reconnect. Tách lỗi USB/CDC/cổng bị chiếm khỏi lỗi firmware.
- [ ] Nạp Digital Input: trước khi nối, xác nhận signal/GND và mức logic. Dùng nguồn thử 0/3.3 V giới hạn dòng/phù hợp; kiểm tra trạng thái hai mức, không dùng BOOT0 hoặc input floating.
- [ ] Nạp ADC Read với đầu vào đã xác nhận an toàn cho ADC; thử GND và mức tham chiếu phù hợp không vượt giới hạn chân. Ghi số đọc/độ ổn định; không suy ra ADC linear/calibrated chỉ từ một lần đọc.
- [ ] Nếu cần, nạp PWM LED47 và đo/quan sát mức PWM; không thay bằng servo12–15 hoặc motor35–42.
- [ ] Ghi lỗi compile/upload với stdout/stderr, code/profile, cổng trước/sau, wiring và kết quả thật. Chỉ đổi trạng thái hardware cho tổ hợp đã thực hiện thành công.

## Biểu mẫu kết quả

Date/time; CodeLab commit + working-tree diff; PCB/module/revision; flash/PSRAM observed; supply/wiring/load; CLI/Core/FQBN; firmware/example; binary checksum; OS/browser/USB/COM; action/expected/observed result; log/waveform; PASS/FAIL/limitation. Không ghi HARDWARE_VERIFIED chỉ từ compile hoặc fake GPIO tests.
