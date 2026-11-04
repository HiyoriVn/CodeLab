# STEAM Robotics Mainboard V2.0 - hardware baseline

Ngày audit: 2026-11-04. Phạm vi: Phase 01, chỉ tài liệu. Pinout đã đối chiếu tài liệu; chưa xác minh board vật lý.

## Nguồn và mức độ xác nhận

| ID | Nguồn đã đọc | Phạm vi |
|---|---|---|
| H1 | `C:/Users/Admin/Documents/Hardware_Reference_Firmware_V2.pdf`, 3 trang, ngày 30/10/2026 | GPIO, đầu nối, khởi tạo, bảng chân cho ESP32-S3-MINI-1-N8 |
| H2 | `C:/Users/Admin/Documents/STEAM_Robotics_Mainboard_V2_Technical_Spec.pdf`, 1 trang, BOM/schematic 30/10/2026 | Nguồn, số lượng ngoại vi, thông số sản phẩm |
| U1 | Yêu cầu TASK 01 của chủ dự án, 2026-11-04 | ESP32 rời chỉ làm PS4 bridge; chọn UART1; không mặc định cấp 5 V sang bridge |
| L1 | `C:/Users/Admin/Documents/ps4-esp32-lib-main.zip` | PS4Bluepad32 1.0.1; mã nguồn thư viện bên ngoài, chưa tích hợp |

Hai PDF không có trong workspace/git lúc audit; tìm thấy bản đúng tên trong Documents, đã trích text và xem đủ 4 trang render bằng Poppler. Không sao chép PDF/ZIP vào repository. Người khác tái kiểm tra cần các bản gốc có hash dưới đây. Schematic P1 và datasheet QMI8658B Rev D/TMI8260 v1.7 được H1 dẫn nhưng chưa được cung cấp như các tài liệu độc lập trong workspace; không coi chúng là đã kiểm tra đầy đủ.

| Nguồn | SHA-256 |
|---|---|
| H1 | `EB0E4586FFDF131E4B7A183F1D4721559EFF7BE2C655915E3E5DB0E23DEDD401` |
| H2 | `1B010FB088EFB3AE17E19799443997ACFC616172BDB462BB258972623EA39D4E` |
| L1 | `8DF591B12BF9AF181B7EC260A99B14261FBC5C6A445F7C7121108086F30AFF61` |

Trong tài liệu: **tài liệu xác nhận** = H1/H2, **quyết định** = U1, **đề xuất** = chưa triển khai, **chưa rõ** = nguồn không quy định. Một yêu cầu khởi tạo trong PDF không phải bằng chứng firmware hiện tại đã làm đúng.

## Phần cứng theo tài liệu

| Thành phần | Dữ liệu xác nhận | Nguồn |
|---|---|---|
| MCU | ESP32-S3-MINI-1-N8; hai nhân, tối đa 240 MHz, flash 8 MB | H1 tr.3 §7; H2 tr.1 |
| Radio mainboard | Wi-Fi 2.4 GHz, Bluetooth 5 LE | H2 tr.1 |
| DC motor | 6 TMI8260; mỗi kênh 2 tín hiệu IN1/IN2, PWM điều chỉnh tốc độ; jack 1=OUT2, 2=OUT1 | H1 tr.1 §1, tr.3 §7; H2 tr.1 |
| Servo | 6 tín hiệu PWM trực tiếp; ba hàng signal/+5V_Servo/GND | H1 tr.1 §2 |
| Encoder | 2 cổng quadrature A/B, cấp 3.3 V | H1 tr.2 §3.1 |
| IMU | QMI8658B, 6 trục, I2C 7-bit `0x6A`, polling hoặc FIFO | H1 tr.2 §3.2; H2 tr.1 |
| Bus | 2 UART, 2 đầu cắm I2C chung một bus, 1 SPI, USB-C native, GPIO mở rộng | H1 tr.2-3; H2 tr.1 |
| Buzzer / điều khiển | GPIO26 bật MOSFET khi HIGH; BOOT GPIO0 và RESET EN nhấn LOW | H1 tr.3 §4 |

Xem toàn bộ 39 GPIO + EN và chân nguồn tại [PINOUT.md](PINOUT.md). Không có GPIO dành riêng cho IMU interrupt hay servo power-good được chỉ ra trong hai PDF.

## Nguồn và giới hạn

- Nguồn chính 7-15 V DC qua XT30 hoặc jack DC; motor nhận nguồn đầu vào trực tiếp (H2 tr.1).
- 4 A/kênh motor là định mức IC theo H2, không phải dòng liên tục đã đo của board; chưa có hồ sơ nhiệt hoặc tổng tải đồng thời.
- +5V_Servo: 5 V, tối đa 12 A theo định mức IC nguồn, tổng cho servo (H2). Không suy ra mỗi servo được 12 A.
- +5V_Core: 5 V danh định, mức thiết kế 2 A (H2). Chưa có ngân sách dòng đã đo khi cấp thêm bridge.
- Encoder: chân nguồn 3.3 V. UART/I2C/SPI: chân nguồn +5V_Core nhưng tín hiệu logic 3.3 V (H1 tr.3 §6). Pull-up I2C của module ngoài phải lên 3.3 V.
- USB-C dùng nạp và cấp phần điều khiển; chạy motor/servo cần nguồn chính 7-15 V (H2). Không suy ra USB cấp đủ nguồn động lực.
- Điện áp rail riêng của IMU/buzzer, mạch chống backfeed, power-good, thời gian ổn định nguồn, loại servo và tải thực tế: chưa được hai PDF quy định đầy đủ.

## Khởi tạo và trạng thái an toàn theo H1 tr.3 §7

| IN1 | IN2 | OUT1 / OUT2 | Chế độ |
|---:|---:|---|---|
| 0 | 0 | Cả hai high-impedance | Thả trôi |
| 1 | 0 | HIGH / LOW | Chiều thứ nhất |
| 0 | 1 | LOW / HIGH | Chiều ngược lại |
| 1 | 1 | Cả hai LOW | Phanh |

Khởi tạo 12 tín hiệu motor và BUZZ_EN về LOW. Servo chỉ phát xung sau khi nguồn servo ổn định. Khi cấp USB để nạp/kiểm tra: motor LOW, servo LOW hoặc high-impedance. Chiều quay cơ khí xác định bằng dây và hiệu chỉnh từng motor. Chưa chọn tần số PWM motor, chu kỳ/xung servo, giới hạn tốc độ/đảo chiều hay chế độ phanh khi lỗi; các quyết định này cần dữ liệu tải và đánh giá ở phase tương ứng.

Firmware chỉ có thể quản lý GPIO sau khi CPU chạy; mức chân trong reset/mất nguồn và điện trở kéo cần schematic/đo kiểm. Không tuyên bố phần mềm đảm bảo trạng thái nguồn trước khi khởi động.

## ESP32 PS4 bridge - quyết định U1

Bridge chỉ nhận PS4 và gửi trạng thái về mainboard, không điều khiển tải. Mainboard TX GPIO6 (UART1 chân 3) nối bridge RX; mainboard RX GPIO7 (chân 4) nối bridge TX; GND chân 1 nối GND chung. UART1 chân 2 là +5V_Core: để chưa nối nguồn sang bridge cho tới khi xác minh đầu vào và cách cấp nguồn. GPIO phía bridge chưa xác nhận, không lấy GPIO6/7 của mainboard làm pinout bridge.

Chip/board bridge, nguồn vào, LED và UART riêng của bridge chưa rõ. PS4Bluepad32 là ứng viên do người dùng cung cấp, không phải bằng chứng chip hỗ trợ Bluetooth Classic. Bluepad32 nêu DualShock dùng BR/EDR và ESP32-S3 không có Classic: [FAQ chính thức](https://bluepad32.readthedocs.io/en/latest/FAQ/), đối chiếu ngày 2026-11-04. Chỉ triển khai sau khi nhận diện chip thực tế. Xem [đánh giá thư viện](../architecture/PS4_LIBRARY_AUDIT.md).

## Đối chiếu module, không sửa sơ đồ

[Datasheet Espressif MINI-1 v1.7](https://documentation.espressif.com/esp32-s3-mini-1_mini-1u_datasheet_en.html), bảng 1-1 và 3-1, phân biệt N8 (8 MB Quad SPI, không PSRAM) với N4R2. Ghi chú IO26 dành cho PSRAM áp dụng N4R2; không dùng cảnh báo tổng quát GPIO26-37 của generator để tự đổi GPIO buzzer/motor trên N8. Datasheet cũng có lưu ý chức năng mặc định một số chân phụ thuộc eFuse. Giữ pinout H1; xác minh module/FQBN/cấu hình thực tế trước firmware. Nguồn Espressif chỉ dùng đối chiếu khả năng module, không thêm pin board vào bảng trích H1.

## Các dữ liệu còn thiếu

1. Board vật lý đúng revision/module, schematic/BOM đầy đủ và toolchain/FQBN/USB configuration.
2. Chip và board bridge, nguồn vào, UART pins, phương án debug riêng, phiên bản Bluepad32 package.
3. Motor/servo/encoder cụ thể: dòng tải, xung servo, encoder PPR/CPR, hộp số, kích thước bánh và cơ cấu robot.
4. Cách chứng minh servo power stable; chưa có cảm biến nguồn/power-good được xác nhận.
5. UART baud/cadence/packet version/checksum/timeout và hành vi reconnect cần đặc tả; 115200/250 ms hiện là giá trị phần mềm legacy.
