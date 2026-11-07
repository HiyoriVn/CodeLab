# Phase 02.2 — BoardConfig & Safe Startup

Ngày 2026-11-05. Phạm vi: [Issue #17](https://github.com/HiyoriVn/CodeLab/issues/17). Không flash, không chọn cổng COM, không thay dependency, không sửa Blockly/UI/PS4 generator, không commit/push. Phase 01/02.1 được giữ nguyên.

## Source và thiết kế

- `firmware/mainboard/BoardConfig.h`: sáu cặp motor, sáu servo, hai encoder, UART0/1, I2C + IMU address, SPI, buzzer, USB, BOOT/strapping và expansion aliases. `validMap()` + static assertions kiểm tra 39 unique GPIO trong tập chân module; test độc lập so từng mapping với H1/Issue #17.
- `firmware/mainboard/SafeStartup.h`: một instance dùng một lần trong setup, gọi lại không thêm I/O. Hi-Z servo, nạp 13 latch LOW trước khi bật 13 output. Không có PWM, bus initialization hoặc API arming. Status giữ init result; mọi lỗi đều không armed/servo-enabled; lỗi preload không bật output.
- `firmware/mainboard/mainboard.ino`: ESP-IDF GPIO adapter dưới Arduino Framework. `setup()` gọi startup; `loop()` chỉ nhường scheduler bằng delay 1000 ms.
- `firmware/tests/startup_test.cpp`: fake I/O chạy trên Windows, không truy cập GPIO hoặc board.

## Host checks

Commands (PowerShell, repository root):

```powershell
New-Item -ItemType Directory -Force firmware/tests/build-output
& 'C:/Users/Admin/AppData/Local/Programs/mingw64/bin/g++.exe' -std=c++17 -Wall -Wextra -Werror firmware/tests/startup_test.cpp -o firmware/tests/build-output/startup_test.exe
& './firmware/tests/build-output/startup_test.exe'
```

Kết quả đã chạy: compiler exit 0; test exit 0:

```text
PASS: 39 GPIO mappings, aliases, straps, startup order/defaults, repeat and error paths
```

Test kiểm tra chính xác 6x2 motor map; toàn bộ 39 GPIO; alias TX6/RX7/CS10, strapping0/3/45/46, IMU0x6A; startup 6 Hi-Z + 13 LOW preload + 13 OUTPUT theo thứ tự; default/repeated call không armed; injected failures ở Hi-Z/preload/output đều không initialized và không auto-enable. Exact event list cũng bảo đảm không thao tác USB/strapping/bus/encoder. Đây là test logic; không phải phép đo điện trên chân thực.

## Firmware compile

Toolchain: Arduino CLI 1.5.1, Espressif Arduino Core **3.3.7** (không Bluepad32), FQBN `esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled`. Chạy ngoài sandbox với quyền được phê duyệt vì Phase 02.1 đã gặp lỗi DLL khi sandbox launch compiler. Không thay cấu hình Arduino IDE/OpenBlockDesktop.

```powershell
$cli='C:/Users/Admin/AppData/Local/Programs/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:/Users/Admin/AppData/Local/Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS='C:/Users/Admin/AppData/Local/Arduino15/staging'
& $cli compile --fqbn 'esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled' --output-dir firmware/mainboard/build-output firmware/mainboard
```

Raw command/stdout/stderr/exit và artifact sizes lưu local tại `docs/verification/phase02_2_compile.log` (ignored để không đưa verbose logs vào Git theo issue). Build outputs/binary/host executables cũng ignored; báo cáo ngắn này và source/tests mới là tài liệu review.

## Giới hạn và gate

Firmware không thể bảo đảm LOW trước CPU/GPIO init. Pull-state/reset waveform cần xác minh PCB. No POWER_GOOD được giả định; servo không có enable API ở phase này, vẫn DISABLED. Không coi startup thành công là nguồn ổn định hoặc quyền điều khiển tải. Chưa thử USB-only/reset/cấp nguồn/động cơ/servo trên board; **PENDING_HARDWARE_VALIDATION**. Chưa có motor/servo/encoder drivers, PS4 bridge hoặc controller parser; CSV v1 giữ nguyên. Chỉ dừng ở skeleton Phase 02.2.

## Kết quả chốt

**VERIFIED_BUILD: PASS, exit 0.** CLI 1.5.1 và Core 3.3.7 được kiểm tra lại trực tiếp. Flash accounting: 273,391 / 3,342,336 B (8%). Global RAM: 21,428 / 327,680 B (6%), còn 306,252 B. Artifacts kiểm tra được: `mainboard.ino.bin` 273,536 B, ELF 6,288,700 B, merged BIN 8,388,608 B. Chưa upload bất kỳ artifact nào.

**Host compile/test: PASS, exit 0 / 0.** `git diff --check`: PASS (chỉ cảnh báo line ending LF/CRLF). `git check-ignore` xác nhận binary firmware, host executable, raw compile log bị loại trừ. Diff `src/` và `tools/` rỗng.

**READY_FOR_PHASE02_3** theo software acceptance; **PENDING_HARDWARE_VALIDATION** giữ nguyên. Phase 02.3 chưa được triển khai. Không coi kết quả compile/test là board hoặc motor/servo hardware acceptance.
