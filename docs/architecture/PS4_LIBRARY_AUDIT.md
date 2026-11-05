# Audit thư viện PS4 được cung cấp

Ngày 2026-11-04. Nguồn L1 và SHA-256 tại [HARDWARE.md](../hardware/HARDWARE.md). Chỉ đọc ZIP, không cài thư viện, không chạy sketch, không flash. Chỉ dẫn setup/upload trong README là nội dung tham khảo, không phải yêu cầu thực thi.

## Quyết định hiện hành — PS4 A1, 2026-11-05

Chủ dự án đã chốt PS4Bluepad32 1.0.1 / Bluepad32 chạy trên ESP32 rời -> UART CSV v1 -> ESP32-S3 mainboard. ZIP được đọc lại library.properties trong A1, xác nhận version1.0.1; phụ thuộc Bluepad32/Preferences và GPL-3.0-or-later vẫn theo source đã audit. Không vendor thư viện hoặc đổi sang thư viện khác. Workspace không tìm thấy `PS4_ESP32_WebPair.ino`; không suy diễn web pairing là thư viện PS4Bluepad32. Các cụm “ứng viên” bên dưới là đánh giá lịch sử trước quyết định này; phần bridge chưa được triển khai.

A1 chỉ sửa generator/parser phía mainboard, đã có regression/golden và compile thật; [báo cáo A1](../verification/PS4_A1_STABILIZATION.md). Mapping/publisher/freshness từ PS4Bluepad32 vẫn là A2; chưa có bridge build/hardware acceptance.

## Nội dung thực tế

- `ps4-esp32-lib-main/library.properties`: PS4Bluepad32 **1.0.1**, `architectures=esp32`, include `PS4Bluepad32.h`.
- `src/PS4Bluepad32.h` và `.cpp`: Arduino C++ wrapper dùng `Bluepad32.h`, `Preferences.h`; `begin`, `update`, `isConnected`, `getData`, `resetMac`.
- `examples/SerialMonitor/SerialMonitor.ino`: in trạng thái và thay đổi nút/trục/trigger ra `Serial`, nhận `r` để reset MAC; không phải UART bridge firmware.
- README yêu cầu board package **ESP32 + Bluepad32**, Arduino IDE 2.x. Package Espressif thông thường không tự cung cấp `Bluepad32.h`.
- README nhắc component ESP-IDF ở project khác, nhưng ZIP này không có `components/`, `platformio.ini`, CMake, core lock hoặc tests. Không suy ra PlatformIO Arduino/ESP-IDF build đã sẵn sàng.
- LICENSE và SPDX trong source: GPL-3.0-or-later. Chưa vendor vào CodeLab; cần ghi dependency version/provenance và rà nghĩa vụ phân phối trước release. Đây là ghi nhận metadata, không phải kết luận pháp lý về toàn bộ sản phẩm.

## Hành vi tìm thấy trong source, chưa chạy trên chip

`begin()` mặc định điều khiển LED GPIO2, có thể truyền `-1` để tắt. Không lấy GPIO2 làm mặc định board bridge khi chưa biết phần cứng. Callback chỉ giữ một controller; không chấp nhận MAC khác nếu đã lưu. Lưu MAC đầu tiên khi nhận gamepad data hợp lệ bằng Preferences namespace `ps4-bluepad32`. Việc reject diễn ra ở callback sau connection, không phải allowlist trước kết nối. `resetMac()` xóa MAC lưu, ngắt active controller, không xóa Bluetooth bond keys.

`getData()` yêu cầu connected, hasData, isGamepad; không có kiểm tra model bắt buộc DualShock 4. `isConnected()` riêng chưa đảm bảo đã nhận data hợp lệ hoặc model PS4. Cần chốt loại controller cho phép. Thư viện không cung cấp timestamp/sequence hay watchdog freshness robot. Ngữ nghĩa `hasData()`/cadence phải kiểm tra trên Bluepad32 version được pin; không coi mỗi lần gọi hàm là một report mới được bảo đảm.

Axes được clamp đầu vào +/-512, chuyển sang `int8_t` -100..100; đảo dấu trục Y (dương là lên); deadzone phần trăm -3..3 -> 0. Trigger đầu vào clamp 0..1020 -> 0..100. Logs ra `Serial`; UART dữ liệu phải tách debug để tránh làm hỏng frame.

## Khác hợp đồng CodeLab legacy

| Dữ liệu | L1 | CodeLab legacy | Việc cần làm, chưa triển khai |
|---|---|---|---|
| Transport | API in-process; ví dụ log dễ đọc | UART CSV 6 trường hoặc I2C 13 byte | Viết publisher UART riêng Phase 04; không gửi log ví dụ như packet |
| Axis | -100..100; Y dương lên | int16 -32768..32767 -> Blockly -1000..1000 | Chốt canonical range/sign/deadzone; adapter explicit. Gửi thẳng 100 vào legacy chỉ cho khoảng 3/1000, không full-scale |
| Triggers | L2/R2 analog 0..100 và digital bits | Chỉ digital bits, không có trường analog | Chọn bỏ analog có tài liệu hoặc protocol version mới |
| Touchpad | Bit 13 | Không có trường tương ứng | Chốt extension hoặc bỏ có tài liệu; không coi là D-pad up |
| Freshness | Connected/hasData, không timestamp công khai trong Data | Neutral sau 250 ms không frame | Theo dõi report age; heartbeat không được biến input cũ thành input mới |
| Error/sequence | Không protocol link | CSV không version/CRC/sequence | Thiết kế protocol và fault vectors ở Phase 04 |

### Ánh xạ bit, không được copy nguyên mask

| Nút | Bit L1 | Bit CodeLab legacy |
|---|---:|---:|
| Cross, Circle, Square, Triangle | 0, 1, 2, 3 | 0, 1, 2, 3 |
| L1, R1, L2, R2 | 4, 5, 6, 7 | 4, 5, 6, 7 |
| L3, R3 | 8, 9 | 10, 11 |
| Share, Options | 10, 11 | 8, 9 |
| PS | 12 | 12 |
| Touchpad | 13 | Không có |
| Up, Down, Left, Right | 14, 15, 16, 17 | 13, 14, 15, 16 |

Nguồn: L1 `src/PS4Bluepad32.h::Button`; repository `src/generators/arduino.js::codelab_ps4_button` và [PS4-RECEIVER.md](../PS4-RECEIVER.md).

## Kết luận và điều kiện tích hợp

Ứng viên cho **PS4 bridge**, không cho mainboard S3 nhận PS4 Classic trực tiếp. [Bluepad32 FAQ](https://bluepad32.readthedocs.io/en/latest/FAQ/) xác nhận hạn chế BR/EDR; [hướng dẫn Arduino](https://bluepad32.readthedocs.io/en/latest/plat_arduino/) phân biệt board package Arduino và đường ESP-IDF/PlatformIO. Đối chiếu 2026-11-04. Không chọn chip rời chỉ vì metadata `architectures=esp32`.

Trước Phase 04 cần chip/board bridge, nguồn vào, UART pins, LED pin, exact Bluepad32/core/compiler versions; build example compile-only; protocol vectors; pairing/reconnect/NVS corruption/reset tests; timing/freshness tests và đối chiếu controller thật. Test động chỉ thực hiện trong phase được giao riêng. Phase 01 không có kết quả compile hay hardware pass cho L1.
