# Board profiles — V1 test board, V2 target board

Cập nhật 2026-11-05. Nguồn cấu hình dùng chung: `src/boards/profiles.js` (UI, generator, HTTP bridge, ví dụ và tests cùng import). V2 native `firmware/mainboard/BoardConfig.h` và SafeStartup đã nghiệm thu được giữ nguyên; test đối chiếu profile JS với mapping V2. Không thay V2 bằng V1.

| Profile ID | Board / MCU | Flash / PSRAM | Cấu hình build |
|---|---|---|---|
| `newmania-starter-v1` | Newmania Starter V1.0, ESP32-S3-WROOM-1-N8R2 — board kiểm thử | 8 MB / 2 MB Quad SPI | FlashSize=8M, PartitionScheme=default_8MB, PSRAM=enabled, USBMode=hwcdc, CDCOnBoot=cdc |
| `steam-mainboard-v2` | STEAM Robotics V2.0, ESP32-S3-MINI-1-N8 — board mục tiêu | 8 MB / không PSRAM | FlashSize=8M, PartitionScheme=default_8MB, PSRAM=disabled |
| `generic-esp32-s3` | Generic ESP32-S3 — tương thích dự án cũ | Phụ thuộc board thực tế, chưa chọn | FQBN generic; giữ khả năng cấu hình CODELAB_FQBN ở bridge cho profile Generic |

Tất cả dùng core `esp32:esp32` **3.3.7**, CLI được kiểm tra 1.5.1. Base FQBN `esp32:esp32:esp32s3`. Bridge kiểm tra installed_version trước compile; không cài/update core. Bluepad32 Core không dùng cho mainboard.

## Profile thử nghiệm từ mạch thực tế

Người dùng cho phép thêm profile riêng `newmania-v1-16m-opi-experimental` sau probe không GPIO: Flash16777216 B, PSRAM8388608 B khởi tạo được với OPI, eFuse decode8MB AP_3v3. MCU ESP32-S3; chưa khẳng định suffix N16R8 hoặc revision PCB. Build Core3.3.7: `FlashSize=16M,PartitionScheme=default_8MB,PSRAM=opi,USBMode=hwcdc,CDCOnBoot=cdc`. Partition8MB giữ nguyên bố cục nhỏ cho test, phần flash còn lại không dùng.

Chỉ GPIO47 được phép Digital/PWM cho bài test LED có phê duyệt, Serial qua USB. ADC/motor/servo không được hỗ trợ; mọi GPIO khác reserved, đặc biệt35–37 thuộc bộ nhớ trên module Octal. Không nhập lại mapping motor/servo N8R2 khi chưa xác minh PCB. Startup policy `no-board-gpio`: không ghi LOW motor/buzzer hoặc cấu hình servo vì wiring variant chưa xác minh; chỉ explicit LED block cấu hình47. Không chứng minh trạng thái điện trước boot hoặc an toàn cơ cấu; yêu cầu chỉ USB và rút mọi tải. Không tự remap workspace cũ; chân/kênh không hợp lệ sinh diagnostics chặn compile.

V1 N8R2, V2 và Generic được giữ nguyên. Phần N8R2 bên dưới là baseline từ tài liệu, **không áp dụng cho mạch vừa đo**. Không dùng ví dụ `firmware/newmania_v1/examples/` trực tiếp trên variant Octal; dùng `.codelab.json` mới trong `firmware/verification/v1_opi_examples/`. Blink và Serial Hello được compile/upload với phê duyệt riêng: người dùng xác nhận LED47 nhấp nháy đúng; Serial nhận Hello115200. Minimal của profile mới chỉ sinh/host-test, chưa compile/upload. H3 user confirms compile/upload COM4, LED blink, Serial Monitor connection and stale-source/profile guards. PWM LED compile-only PASS; no upload because user stopped session. Digital/ADC disabled pending wiring/tools. [Kết quả và giới hạn](../verification/V1_HARDWARE_INTEGRATION.md).

## Nguồn V1 và đánh giá PSRAM

Tài liệu người dùng cung cấp: [Hướng dẫn sử dụng Kit.docx](<C:/Users/Admin/Downloads/Hướng dẫn sử dụng Kit.docx>), SHA-256 `28076d48dae3782e26d5b7e3887813c37b859bec0cb9172f7ef7471242eb4151`, đọc phần 1.2-1.4, 2.1 và 2.6; ảnh board người dùng đính kèm xác nhận nhãn V1.0, motor/servo/USB/nguồn. Các hướng dẫn upload/MicroPython trong tài liệu không được thực thi, không mở rộng MVP.

Tài liệu xác nhận N8R2, 8 MB flash/2 MB PSRAM, bốn kênh motor/servo, LED47, buzzer17 và pinout dưới đây. Motor kit định mức 3–6 V; nguồn board công bố DC 3–15 V. Phần hướng dẫn cấp nguồn motor chưa nêu đầy đủ đường cấp áp thực tế: **không suy ra 15 V an toàn cho motor**. Chưa có schematic/power budget hoặc xác minh PCB.

Espressif xác định N8R2 là Quad SPI flash + Quad SPI PSRAM: [datasheet WROOM-1](https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf), bảng module comparison; [hướng dẫn chọn QSPI/OPI](https://docs.espressif.com/projects/arduino-esp32/en/latest/troubleshooting.html#how-to-determine-the-module-version) (đối chiếu 2026-11-05). Installed Core 3.3.7 `boards.txt`: `esp32s3.menu.PSRAM.enabled=QSPI PSRAM`, `build.psram_type=qspi`, define BOARD_HAS_PSRAM. Vì thế V1 dùng `PSRAM=enabled`, không copy disabled của V2 hoặc chọn OPI. Các chân 35–37 không được coi là bị OPI chiếm trên biến thể R2; vẫn chặn I/O trực tiếp vì board dùng chúng cho motor.

USB hardware CDC là **cấu hình thử nghiệm phần mềm**, chưa xác minh đường USB trên PCB. Nếu board dùng UART-USB bridge khác, cần xác nhận topology rồi chọn cấu hình phù hợp có ghi nhận; không mặc định đổi profile để né lỗi. Build thành công chưa chứng minh PSRAM hiện diện/dung lượng hoặc Serial hoạt động trên board.

## Pinout V1 từ tài liệu và yêu cầu người dùng

| Thiết bị | GPIO | Chính sách hiện tại |
|---|---|---|
| Motor 1 / 2 / 3 / 4 | 35/36, 37/38, 39/40, 41/42 | Reserved; không cho block H-bridge hay I/O/PWM trực tiếp |
| Servo 1..4 | 12,13,14,15 | Reserved; Hi-Z, không pulse/attach |
| LED Blink | 47 | Digital/PWM được phép; PWM chỉ dùng test LED |
| Buzzer | 17 | Reserved, giữ LOW |
| UART1 TX/RX | 18/21 | Reserved, chưa khởi tạo; không dùng pin UART1 V2 6/7 |
| I2C SDA/SCL | 8/9 | Reserved, chưa khởi tạo |
| ADC chính | 1,2,4,5,6,7,10,11 | Digital input/output, ADC, basic PWM được phép sau kiểm tra wiring |
| ADC mở rộng | 3,16 | 16 được phép; 3 vẫn chặn do strapping dù có ADC trên connector |
| BOOT / RESET | 0 / EN | Không sử dụng làm GPIO ứng dụng; EN không là số GPIO |
| USB | 19/20 | Reserved theo MCU/native USB; pinout kit không mô tả chi tiết USB net |

Mức tín hiệu ESP32 phải tương thích 3.3 V; nguồn connector không chứng minh tín hiệu chịu được 5 V. Không có xác nhận voltage/pin numbering connector đầy đủ ngoài bảng đã cung cấp. Chân chưa có mapping, flash/PSRAM và strapping0/3/45/46 đều không được test trực tiếp. Hai chức năng khác nhau yêu cầu cùng chân (ví dụ ADC INPUT và digital OUTPUT/PWM) tạo warnings chặn compile; không có tự động remap.

V2 giữ [pinout đã nghiệm thu](../hardware/PINOUT.md): 6 motor, 6 servo, encoder2, IMU/I2C/UART/SPI/buzzer/USB. Profile web hiện hỗ trợ safe startup, Serial và vô hiệu tín hiệu servo cho V2; mọi chân onboard đều được reserved đối với generic I/O. Các driver điều khiển V2 là nhiệm vụ tiếp theo, chưa triển khai. Generic giữ block types và semantics cũ, cảnh báo rủi ro chip/USB/strapping; không có mapping an toàn universal và không tự thêm startup board-specific.

## Generation và firmware

Generator nhận `generateArduino(workspace, boardId)`; không có pin map V1/V2 hardcode trong generator. `src/boards/startup.js` render shared startup cho profile cụ thể: servo INPUT/FLOATING, nạp latch motor/buzzer LOW trước khi bật direction OUTPUT, dừng setup nếu lỗi. Chỉ thiết lập sau CPU boot; chưa xác minh các mức này bằng đo board, và chưa xác minh truth table driver V1. Không khẳng định phần mềm thay thế pull-state/circuit bảo vệ trước boot. Không tự enable/PWM motor/servo hoặc giả định POWER_GOOD.

`firmware/newmania_v1/newmania_v1.ino` là firmware kiểm thử V1 độc lập, sinh từ cùng registry/generator. `tools/v1-examples.mjs` sinh `.ino` standalone và file workspace đi kèm cho minimal, blink, serial, digital input, ADC, PWM LED. Có thể tái sinh bằng `npm run examples:v1`. Native V2 không sửa, firmware PS4 bridge không thêm.

## Workspace compatibility và upload

### Robotics toolbox — 2026-11-05

`src/blocks/robotics-toolbox.js` lọc ADC/PWM theo capabilities; V2 không mở các chân onboard reserved cho generic I/O. V1/V2 dùng block kênh motor/servo lấy mapping từ registry, không nhập GPIO motor thủ công. V1 có M1–M4/S1–S4, V2 có M1–M6/S1–S6. Dropdown giữ giá trị 1–6 để bảo toàn workspace khi đổi board; các kênh vượt capability được ghi không hỗ trợ và generator cảnh báo, không remap.

Motor motion và servo enable/write hiện chỉ có API/block cùng diagnostics chặn compile; không sinh lệnh tải. Servo disable sinh INPUT/FLOATING trên signal đã map, không attach/PWM, không cấp/ngắt nguồn và không chứng minh an toàn khi thả cơ cấu. Chưa có power-stable interlock; không giả định POWER_GOOD. Generic giữ block H-bridge legacy; không coi đó là driver V1/V2 đã được xác minh.

Digital input có tùy chọn no pull/pull-up/pull-down; Serial print/println, available và read dùng `Serial` 115200 đã có, không thay UART1 PS4. Sensor hiện chỉ có primitives digital/ADC, chưa có dedicated IMU/encoder/range driver. [Báo cáo và ví dụ Robotics](../verification/ROBOTICS_BLOCKS_INTEGRATION.md).

Giữ `codelab.projects.v1`, định dạng `codelab-project` version1 và nguyên schema Blockly. Thêm trường **optional** `project.boardId`; file/local project cũ thiếu trường chọn Generic. Chọn board lưu metadata, không sửa các số GPIO trong block cũ. Export/import bảo toàn trường board; unknown boardId trong file import báo lỗi trước khi thay dự án. Code được sinh lại từ cùng workspace khi đổi board; warnings nếu pins cũ không phù hợp, không đổi chân âm thầm.

Compile request thêm `boardId` (thiếu -> Generic). Backend chỉ chấp nhận profile trong registry; không lấy arbitrary FQBN từ request. Successful build lưu FQBN, boardId và source. UI/backend đều từ chối upload khi source/profile không khớp build; upload dùng FQBN đã compile và cổng được người dùng chọn. `/api/upload` cần `confirmed:true`, `code`, `boardId` cùng buildId/port. Đây là bổ sung kiểm tra cho API cũ; client ngoài UI cần gửi các trường này.

Compile không upload. Port luôn mặc định chưa chọn; không tự chọn COM đầu tiên. Lỗi compile/upload hiển thị cả stderr/stdout. Mở Device dialog đóng/unmount Serial Monitor để trả cổng; đóng serial panel cũng ngắt cổng và xóa log panel, cần sao chép log trước khi đóng. Serial I/O và upload thực vẫn HARDWARE_UNTESTED.
