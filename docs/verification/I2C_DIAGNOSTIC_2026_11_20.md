# Chẩn đoán ESP32 D1 ↔ ESP32-S3 — 20/11/2026

## Kết luận

**Chưa xác định nguyên nhân lỗi giao tiếp hiện tại: chưa có log trên hai board của phiên này.** Không upload, mở COM hoặc thử tải. Chủ dự án xác nhận D1 **SDA16/SCL17** là chuẩn; giữ nguyên source. Hướng dẫn hiện hành còn ghi 22/21 đã được sửa; sai tài liệu không chứng minh dây thực tế đang sai.

Checkout kiểm tra: nhánh `main`, HEAD `a2651e7`. Không commit/push/chuyển nhánh. Không sửa motor, servo, Bluetooth, pairing, PS4 protocol, scheduler, board profile hoặc source ứng dụng.

## Cấu hình và vị trí code

| Thành phần | Vai trò / cấu hình | Vị trí |
|---|---|---|
| D1 PS4 | Slave, SDA16/SCL17, 7-bit `0x30`, `Wire.begin(address,sda,scl,100000)` | `firmware/ps4_i2c_bridge/ps4_i2c_bridge.ino:17,43` |
| S3 demo I2C | Master, SDA8/SCL9, 100 kHz, Wire timeout20ms, poll10ms | `firmware/demos/newmania_ps4_i2c/newmania_ps4_i2c.ino:36,44-49` |
| S3 runtime chung | Master khi chọn I2C, 8/9, 100 kHz, timeout20ms, poll tối thiểu6ms, đọc cố định `0x30` | `firmware/libraries/CodeLabFast4wd/src/CodeLabFast4wd.h:200-206,254-255` |
| Các demo motor | Master 8/9, 100 kHz, 20ms, đọc13 byte | `firmware/demos/newmania_ps4_4wd_fast100`, `newmania_ps4_dual_motor`, `newmania_ps4_motor_candidate` |
| Adapter Blockly cũ | `Wire.begin(sda,scl)` theo block, không truyền frequency; timeout10ms; đọc13 byte | `src/generators/arduino.js:90-108,589` |
| Generator Newmania | Transport theo block `TRANSPORT`; I2C sinh `Ps4Transport::I2c`; UART/PS2 riêng | `src/generators/newmania.js:267-276` |

D1 16/17 là xác nhận trực tiếp của chủ dự án, không suy ra từ mặc định Dev Module. S3 8/9 đối chiếu `docs/hardware/PINOUT.md` (H1 tr.2 §3.2, tr.3 §6), `docs/boards/BOARD_PROFILES.md`, `src/boards/profiles.js`. Tài liệu V2 không chứng minh mọi chi tiết PCB của board thử nghiệm N16R8.

| D1 | S3 |
|---|---|
| SDA GPIO16 | SDA GPIO8 |
| SCL GPIO17 | SCL GPIO9 |
| GND | GND |

Không đấu chéo SDA/SCL. USB-only, tháo tải motor/servo, không DC ngoài, không nối +5V hai board. Pull-up tín hiệu về **3.3V**; đo idle trước khi kết luận driver. Giá trị điện trở thực tế chưa biết. Nếu V2 có IMU, `0x6A` là thiết bị khác, không phải D1.

## Toolchain đã đọc trên máy

| Target | Package CLI | Arduino-ESP32 bên trong | ESP-IDF |
|---|---|---|---|
| D1 Classic ESP32 | `esp32-bluepad32:esp32` **4.1.0** | **2.0.17** | **4.4.7** |
| S3 | `esp32:esp32` **3.3.7** | **3.3.7** | **5.5.2** |

CLI1.5.1. D1 đọc `cores/esp32/esp_arduino_version.h`, `tools/sdk/esp32/include/esp_common/include/esp_idf_version.h` trong package4.1.0. S3 đọc core và `esp32s3-libs/.../esp_idf_version.h`. **Bluepad32 package4.1.0 không phải Arduino-ESP32 4.1.0.** Đây là bản cài trên máy, chưa xác nhận firmware đang chạy trên thiết bị. Sketch diagnostic in phiên bản runtime. Khác phiên bản không tự chứng minh không tương thích I2C.

## Initialization, callback, truyền nhận và lỗi

- D1 gọi `ps4::begin()` trước Wire. Nếu thiếu banner `PS4 I2C slave ... ready=...`, phải kiểm tra setup đã tới Wire chưa. Callback đăng ký trước begin; overload address xác nhận slave.
- `onRequest()` snapshot13 byte có critical section; BT quá hạn thì neutralize; `Wire.write` toàn frame; không gọi Bluetooth/Serial, không tăng sequence do poll. `Wire.slaveWrite` preload đầu theo ví dụ Classic ESP32 cài trên máy. Return preload/write chưa được log trong ứng dụng hiện tại.
- Driver D1 `TwoWire::onRequestService()` gọi callback rồi chuyển buffer qua slaveWrite. Classic ESP32 preload FIFO có thể làm dữ liệu trễ một lượt đọc; phải đo trước khi coi là lỗi. Echo cho phép retry cùng sequence trong300ms.
- `onReceive()` chỉ đọc byte, đánh dấu reset MAC nếu gặp `r/R`; reset xử lý ngoài callback. **Không phải callback nhận joystick:** S3 chủ động đọc frame D1 publish. S3 master không cần onReceive.
- Hai image hiện tại mặc định `0x30`,13 byte binary: flags connected+sequence7bit, bốn int16 LE, buttons uint32 LE. `0x55`/ASCII là thông tin sketch gốc ghi trong tài liệu lịch sử. File gốc không còn tại đường dẫn Downloads của phiên này; không tuyên bố đọc lại file đó.
- S3 kiểm tra count và số byte thực đọc trước ingest; errors chưa tách NACK/timeout/frame. Luồng bình thường không probe địa chỉ.
- `Wire.begin == true`, `bus=1`, `Blockly I2C=1 MCPWM=1` chỉ xác nhận init, **không chứng minh D1 đã ACK**.
- Wire timeout20ms khác freshness timeout **>250ms** của `I2CReceiver.h`. Frame đầu baseline, sequence lặp không refresh deadline, lỗi/timeout neutralize. Đủ13 byte không chứng minh có report PS4 mới. Không thay safety/reconnect.
- Adapter legacy `src/generators/arduino.js:90-108` refresh timestamp cho mọi frame đủ length, không kiểm sequence; giới hạn đã ghi trong PS4-RECEIVER.md. Không dùng thay robotics receiver; không sửa trong task này.
- Fast4wd đọc cố định0x30 trong khi sketch demo có macro address: nếu D1 build address khác và S3 dùng Blockly runtime sẽ lệch. Chưa có bằng chứng người dùng đổi address.
- Cần xem preview thực sự chọn `Ps4Transport::I2c`. `CodeLabNewmania.h:38-45` mặc định UART khi `SERIAL_8N1` tồn tại. Host mocks thiếu macro này không thay kiểm tra transport target. Không đổi default/workspace.
- `requestFrom` chỉ trả số byte; API Wire các bản cài không cung cấp mã read error riêng. Giữ log `Wire.cpp ... i2cRead returned Error ...` với Core Debug Level Error. Không gán mã probe/write trước đó thành mã lỗi read.

## Bằng chứng lịch sử

Commit `3f8f78a` đổi D1 22/21→16/17 và assertion trong `tests/i2c.test.mjs`; tài liệu đi dây chưa cập nhật. Chủ dự án xác nhận16/17 ngày20/11. Không đảo source để khớp tài liệu cũ.

`docs/verification/PS4_I2C_HARDWARE.md` ghi đầu tháng11: cắm lại dây22/21 thì S3 nhận connected/fresh tăng, errors ngừng tăng; sau đó có quan sát joystick mock. Đây là **biên bản lịch sử**, không phải log mới và không xác nhận setup16/17. Giữ nguyên log lịch sử.

Chưa biết binary đang chạy, version runtime, điện áp idle/pull-up, continuity16→8/17→9, ACK0x30, waveform, callback D1 và IDF code S3 hiện tại. Chưa chỉ ra được dòng code nào gây lỗi trên thiết bị.

## Bộ kiểm thử đã tạo

| Chương trình | File | Chức năng |
|---|---|---|
| Scanner S3 | `firmware/diagnostics/i2c_scanner_s3/i2c_scanner_s3.ino` | Scan0x08–0x77, log mọi ACK/NACK/error và thời gian; không payload |
| Master echo S3 | `firmware/diagnostics/i2c_echo_master_s3/i2c_echo_master_s3.ino` | Probe0x30, TX8 byte, đọc reply, kiểm sequence/payload/XOR |
| Slave echo D1 | `firmware/diagnostics/i2c_echo_slave_d1/i2c_echo_slave_d1.ino` | 16/17, receive/request callbacks, thống kê, RX/TX hex ngoài callback |
| Helpers | `firmware/libraries/CodeLabI2CDiagnostic/src/` | Packet/log dùng chung; chỉ Arduino/Wire, không dependency ngoài |
| Compile-only | `tools/verify-i2c-diagnostic.ps1` | Kiểm installed core, compile/log/SHA256; không COM/upload/update |

**Chỉ chạy echo master cùng echo slave. Không gửi packet echo vào PS4 bridge:** byte sequence/payload có thể trùng `r/R`, kích hoạt reset MAC của code cũ. Scanner address-only không gửi dữ liệu reset.

Request: `A5 seq 10 20 30 40 50 XOR`; reply: `5A seq 10 20 30 40 50 XOR`;00 là idle/invalid. XOR chỉ phục vụ diagnostic, không bảo đảm chống mọi lỗi. ACK bus khác APP_ACK; chỉ chấp nhận length/sequence/payload/checksum khớp. Reply cũ/idle retry, deadline300ms cộng thời gian giao dịch đang thực hiện. Không Serial/delay trong callback. Master gửi1gói/giây, Serial115200.

Compile từ repo (không nạp):

```powershell
./tools/verify-i2c-diagnostic.ps1 -Target Slave
./tools/verify-i2c-diagnostic.ps1 -Target Scanner
./tools/verify-i2c-diagnostic.ps1 -Target Master
```

S3 script giữ FQBN profile thử nghiệm16MB/OPI đang có; nếu thiết bị thực là V2 N8 phải chọn đúng target đã xác nhận trước nạp, không dùng binary OPI chỉ vì build xong. D1 dùng package Bluepad32 hiện có nhưng echo không include/khởi tạo radio. Arduino IDE cần helper library local và **Core Debug Level: Error**; script truyền `-DCORE_DEBUG_LEVEL=1`.

**Ba compile target đã PASS trên phiên hiện tại** (trước đó log cũ gặp lỗi loader `Illegal System DLL Relocation`, nay đã chạy lại sạch exit 0; log tại `build-output/compile.log` trong từng diagnostic):

| Target | FQBN | Program / Globals | SHA-256 (`.ino.bin`) | Kết quả |
|---|---|---|---|---|
| Scanner (S3) | `esp32:esp32:esp32s3:...PSRAM=opi...` | 338618 B (10%) / 23932 B (7%) | `998F7CF5849CC4D79A7C8BF9FC2134F0B7FB759CB873589BB78599D25C7947CD` | PASS exit 0 |
| Master (S3) | `esp32:esp32:esp32s3:...PSRAM=opi...` | 339398 B (10%) / 23932 B (7%) | `4F8D3F79E727223BA2122EB1DDDD3E63BE0DF9CD5A7D0BC8466F9CD8487FFA3D` | PASS exit 0 |
| Slave (D1) | `esp32-bluepad32:esp32:esp32` | 719029 B (54%) / 87060 B (26%) | `C8A4BBD24E9F7271427A1271D60A14A050976E991F1807F8FD215341C3C7D1B5` | PASS exit 0 |

## Phép thử thiết bị cần thực hiện

1. Ghi board/revision/module, firmware/build options, COM riêng, ảnh dây, USB-only/no loads. Chỉ nạp sau khi chủ dự án đồng ý riêng; không dùng COM cũ mặc định.
2. Chạy scanner S3, D1 đang slave; lấy banner INIT và ít nhất2 lượt SCAN_END cùng log D1. Nếu không thấy0x30, xét điện/dây/init trước parser PS4.
3. Khi build được và được phép nạp, chạy đúng cặp echo; reset D1 trước S3, ghi20 giao dịch. Kỳ vọng PROBE ACK, WRITE ACK, RX đủ8byte, RESULT APP_ACK; D1 rx_events/request_callbacks tăng, invalid=0. Idle/previous FIFO lần đầu được phép nếu có APP_ACK trong deadline. Đây là **kỳ vọng**, không phải log thực đã đo.
4. Nếu echo ổn định, quay về image PS4 đã review/được phép nạp. Ghi banner/pins/address; D1 BT/published_connected/sequence, S3 count/fresh/repeats/errors. Không reset MAC hay đổi pairing khi chưa chứng minh lỗi radio.
5. Giữ nguyên dòng Error IDF và thời gian, không chỉ chụp errors tổng. Nếu ACK nhưng reply lỗi, cần logic analyzer để thấy address/read ACK, số byte và FIFO timing.

## Phân loại log

| Dấu hiệu | Kết luận có thể rút ra | Phép thử tiếp theo |
|---|---|---|
| INIT ready=0 | Driver chưa init thành công | Log IDF, target/pins, init trùng/xung đột; chưa quy lỗi dây |
| INIT1 nhưng NACK0x30 | Chưa thấy ACK tại địa chỉ ấy | Banner/binary D1, pins/address, GND/continuity; chưa biết dây nào hỏng |
| code5 và idle LOW | Có dấu hiệu bus bị giữ thấp/lỗi điện hoặc timing | Đo từng board, pull-up và waveform; không tự đổi GPIO |
| Chỉ thấy0x6A | Thiết bị khác ACK; chưa thấy D1 | Xác minh IMU nếu V2, kiểm nhánh dây D1 |
| code2 | NACK/not found theo core | Core gộp NACK, không tự tách address/data phase |
| WRITE ACK, D1 RX tăng, APP_TIMEOUT | Write tới callback nhưng reply chưa hợp lệ | RX/TX hex, length/seq, request callbacks, FIFO và read error |
| D1 TX_queued8, S3 RX ngắn/sai | Đã queue buffer, chưa chứng minh on-wire delivery | Waveform, pull-up, read ACK/timing |
| Echo20/20 APP_ACK | Cặp diagnostic write/read hoạt động ở điều kiện đã ghi | Chưa nghiệm thu Bluetooth/frame13/watchdog/tải |
| PS4 errors đứng, repeats tăng, fresh đứng | Frame đến nhưng sequence không tiến | BT update/publisher; không biến cached poll thành fresh |
| connected1, fresh tăng, FAULT latched | Dữ liệu mới có, safety còn chặn | Recovery đúng firmware; không bỏ watchdog/auto-arm |

## Sửa nhỏ nhất và hồi quy

Đã sửa tài liệu hiện hành về16/17, giữ source/test pins đúng. Chưa có bằng chứng để sửa driver/protocol/tần số/timeout thật.

- Binary D1 còn22/21 hoặc0x55: đưa image về16/17,0x30/binary13 đúng source; review và xin phép nạp riêng, không đổi motor/PS4 mapping.
- S3 chọn UART trên dây I2C: chọn transport đúng trên block/workspace, preview có `Ps4Transport::I2c`; không đổi default toàn hệ thống.
- Address D1 lệch runtime: về baseline0x30; chỉ thống nhất cấu hình rộng hơn khi có nhu cầu dùng address khác.
- Dây/pull-up lỗi: sửa theo phép đo, không sửa code.
- Echo ACK/write tốt nhưng read lỗi: lấy IDF code/waveform rồi chọn sửa callback/FIFO/driver nhỏ nhất; không nâng core hàng loạt.

`node --test tests/i2c-diagnostic.test.mjs tests/i2c.test.mjs`: **4/4 PASS**. Compile/execute ba sketch diagnostic thật trên host Arduino/Wire mocks: echo, FIFO cũ, NACK, timeout, short/corrupt reply, mất receive callback, drain oversized, sequence255→0, init failure, scanner112address. Frame13/publisher/receiver/mecanum regressions cũng pass. Mock không xác nhận điện/ISR/silicon.

`node --test tests/fast4wd.test.mjs tests/ps4-generator.test.mjs tests/integration-lessons.test.mjs`: **24/24 PASS** (UART/parser/generation/motor mock/watchdog hiện có). App source không đổi, không cần build UI cho sketch độc lập. Arduino target compile **PASS (3/3)**; hardware phiên này **NOT RUN**.

Sau sửa lỗi thật: chạy lại28test trên, compile cả D1/S3, scanner, echo20gói, frame13 sequence tăng và mất link neutral/timeout/reconnect đúng safety. Ghi board/wiring/firmware/log thực. **Chưa kết luận đã sửa giao tiếp.**
