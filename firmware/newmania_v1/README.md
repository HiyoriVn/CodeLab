# Newmania Starter V1.0 test firmware

V1 là board kiểm thử; V2 vẫn là board mục tiêu. `newmania_v1.ino` chỉ giữ motor/buzzer LOW, servo Hi-Z và mở Serial; chưa có hành vi điều khiển robot. Bốn motor/servo không được phép enable. Profile/mapping nguồn: `src/boards/profiles.js`; shared startup renderer: `src/boards/startup.js`. Không sửa native V2.

Các thư mục `examples/` có sketch `.ino` và project `.codelab.json` tương ứng. Import JSON vào CodeLab để kiểm tra cùng luồng generator/compile. `npm run examples:v1` tái sinh nguồn từ profile và Blockly (ID block cố định để review diff). `node tools/verify-v1-build.mjs` kiểm tra compile-only toàn bộ ví dụ qua HTTP bridge với CLI thật; cần thiết lập môi trường như [hướng dẫn test](../../docs/boards/V1_HARDWARE_TEST.md). Không có upload trong script này.

Ví dụ `pwm_led` chỉ PWM LED47 ở 5 kHz/8-bit, duty32; không dùng servo12–15 hoặc motor35–42. ADC/digital input dùng GPIO1 và cần tín hiệu ngoài đã kiểm tra, không đọc nút BOOT0. Không test với input floating. Đèn47 là LED số theo tài liệu kit, không dùng thư viện RGB.
