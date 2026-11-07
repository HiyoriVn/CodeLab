# Pinout trích từ PDF - STEAM Robotics V2.0

Nguồn H1/H2 và SHA-256 được định nghĩa trong [HARDWARE.md](HARDWARE.md). H1 áp dụng ESP32-S3-MINI-1-N8, schematic 30/10/2026. Đã đối chiếu trực quan đủ trang vào 2026-11-04. Bảng chỉ chứa dữ liệu hai PDF; không lấy default trong code làm pinout. **KQĐ** = PDF không quy định; **N/A** = không áp dụng. Cột khởi tạo là yêu cầu tài liệu, không phải trạng thái đã đo. Nguồn thiết bị không đồng nghĩa mức GPIO.

## Motor và servo

Nguồn motor = đầu vào 7-15 V theo H2 tr.1. Logic điều khiển = 3.3 V theo H1 tr.1. LOW motor theo H1 tr.3 §7. Số chân IN1/IN2 bên dưới thuộc IC driver, khác số chân jack motor.

| Thiết bị / tín hiệu | Chức năng / chân kết nối | GPIO | Giao thức | Nguồn thiết bị | Mức tín hiệu | Khởi tạo | Lưu ý / nguồn |
|---|---|---:|---|---|---|---|---|
| M1_IN1 | TMI8260 M1 IN1 chân 2 | 42 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M1_IN2 | TMI8260 M1 IN2 chân 1 | 41 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M2_IN1 | TMI8260 M2 IN1 chân 2 | 40 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M2_IN2 | TMI8260 M2 IN2 chân 1 | 39 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M3_IN1 | TMI8260 M3 IN1 chân 2 | 38 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M3_IN2 | TMI8260 M3 IN2 chân 1 | 37 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M4_IN1 | TMI8260 M4 IN1 chân 2 | 36 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M4_IN2 | TMI8260 M4 IN2 chân 1 | 35 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M5_IN1 | TMI8260 M5 IN1 chân 2 | 48 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M5_IN2 | TMI8260 M5 IN2 chân 1 | 34 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M6_IN1 | TMI8260 M6 IN1 chân 2 | 33 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| M6_IN2 | TMI8260 M6 IN2 chân 1 | 47 | GPIO/PWM | 7-15 V | 3.3 V | LOW | H1 tr.1 §1; tr.3 §7 |
| SERVO1 | Hàng tín hiệu chân 1 | 14 | PWM | +5V_Servo | 3.3 V | Không xung trước nguồn ổn định; USB: LOW/Hi-Z | H1 tr.1 §2; tr.3 §7 |
| SERVO2 | Hàng tín hiệu chân 2 | 15 | PWM | +5V_Servo | 3.3 V | Như SERVO1 | H1 tr.1 §2 |
| SERVO3 | Hàng tín hiệu chân 3 | 16 | PWM | +5V_Servo | 3.3 V | Như SERVO1 | H1 tr.1 §2 |
| SERVO4 | Hàng tín hiệu chân 4 | 17 | PWM | +5V_Servo | 3.3 V | Như SERVO1 | H1 tr.1 §2 |
| SERVO5 | Hàng tín hiệu chân 5 | 18 | PWM | +5V_Servo | 3.3 V | Như SERVO1 | H1 tr.1 §2 |
| SERVO6 | Hàng tín hiệu chân 6 | 21 | PWM | +5V_Servo | 3.3 V | Như SERVO1 | H1 tr.1 §2 |

Mỗi jack motor: chân 1 OUT2, chân 2 OUT1; không phải GPIO. Mỗi servo có vị trí cùng số ở ba hàng signal, +5V_Servo, GND. Không có chân PWM/enable thứ ba riêng cho mỗi TMI8260 trong H1. Chiều cơ khí cần hiệu chỉnh, không quy đổi sẵn IN1/IN2 thành tiến/lùi robot.

## Encoder, IMU và bus

| Thiết bị / tín hiệu | Chức năng / chân kết nối | GPIO | Giao thức | Nguồn thiết bị / đầu nối | Mức tín hiệu | Khởi tạo | Lưu ý / nguồn |
|---|---|---:|---|---|---|---|---|
| ENC1_A | Encoder 1 chân 3 | 1 | Quadrature A/B | 3.3 V | 3.3 V | KQĐ | H1 tr.2 §3.1 |
| ENC1_B | Encoder 1 chân 4 | 2 | Quadrature A/B | 3.3 V | 3.3 V | KQĐ | H1 tr.2 §3.1 |
| ENC2_A | Encoder 2 chân 3 | 4 | Quadrature A/B | 3.3 V | 3.3 V | KQĐ | H1 tr.2 §3.1 |
| ENC2_B | Encoder 2 chân 4 | 5 | Quadrature A/B | 3.3 V | 3.3 V | KQĐ | H1 tr.2 §3.1 |
| I2C_SDA | QMI8658B chân 14; mỗi cổng I2C chân 3 | 8 | I2C | Cổng: +5V_Core; rail IMU: KQĐ | 3.3 V | KQĐ | IMU 0x6A; bus chung; H1 tr.2 §3.2, tr.3 §6 |
| I2C_SCL | QMI8658B chân 13; mỗi cổng I2C chân 4 | 9 | I2C | Cổng: +5V_Core; rail IMU: KQĐ | 3.3 V | KQĐ | Pull-up module lên 3.3 V; H1 tr.3 §6 |
| UART0_TX | UART0 chân 3, TX từ mainboard | 43 | UART0 | +5V_Core tại cổng | 3.3 V | KQĐ | H1 tr.2 §3.3; tr.3 §6 |
| UART0_RX | UART0 chân 4, RX vào mainboard | 44 | UART0 | +5V_Core tại cổng | 3.3 V | KQĐ | H1 tr.2 §3.3; tr.3 §6 |
| UART1_TX | UART1 chân 3; mở rộng chân 4 | 6 | UART1 | +5V_Core tại UART1 | 3.3 V | KQĐ | Hai vị trí cùng net; H1 tr.2 §3.3 |
| UART1_RX | UART1 chân 4; mở rộng chân 5 | 7 | UART1 | +5V_Core tại UART1 | 3.3 V | KQĐ | Hai vị trí cùng net; H1 tr.2 §3.3 |
| SPI_SCK | Cổng SPI chân 3 | 12 | SPI | +5V_Core tại cổng | 3.3 V | KQĐ | H1 tr.2 §3.4; tr.3 §6 |
| SPI_MOSI | Cổng SPI chân 4, tới thiết bị | 11 | SPI | +5V_Core tại cổng | 3.3 V | KQĐ | H1 tr.2 §3.4 |
| SPI_MISO | Cổng SPI chân 5, về mainboard | 13 | SPI | +5V_Core tại cổng | 3.3 V | KQĐ | H1 tr.2 §3.4 |
| SPI_CS | Cổng SPI chân 6; mở rộng chân 6 | 10 | SPI | +5V_Core tại SPI | 3.3 V | KQĐ | Cùng net ở hai vị trí; H1 tr.2 §3.4 |
| USB_D- | USB-C DN1, DN2 | 19 | USB native | USB cấp phần điều khiển; chi tiết rail KQĐ | Dữ liệu USB; thông số điện riêng KQĐ | Dành riêng USB | H1 tr.2 §3.5; H2 tr.1 |
| USB_D+ | USB-C DP1, DP2 | 20 | USB native | Như USB_D- | Dữ liệu USB; thông số điện riêng KQĐ | Dành riêng USB | H1 tr.2 §3.5 |

PDF nêu logic GPIO 3.3 V, không cung cấp thông số điện USB PHY; không suy ra D+/D- là GPIO mở rộng tự do. Hai đầu I2C cùng bus với IMU, không phải hai controller độc lập; địa chỉ thiết bị phải khác nhau. PDF không chỉ ra IMU INT hoặc giá trị điện trở pull-up/clock I2C/baud UART/mode SPI.

## Buzzer, BOOT, RESET và GPIO mở rộng

| Thiết bị / tín hiệu | Chức năng / chân kết nối | GPIO | Giao thức | Nguồn thiết bị | Mức tín hiệu | Khởi tạo | Lưu ý / nguồn |
|---|---|---|---|---|---|---|---|
| BUZZ_EN | Gate MOSFET buzzer | 26 | GPIO | Rail buzzer KQĐ | 3.3 V | LOW | HIGH bật; H1 tr.3 §4, §7 |
| IO0 / BOOT | Nút BOOT | 0 | Strapping / GPIO | N/A (nút) | 3.3 V, nhấn LOW | Giữ mức boot phù hợp; chi tiết KQĐ | H1 tr.3 §4-5 |
| EN / RESET | EN module, nút RESET | EN (không phải số GPIO) | Reset phần cứng | N/A (nút) | Nhấn LOW; thông số EN riêng KQĐ | KQĐ | H1 tr.3 §4 |
| IO3 | Mở rộng chân 1 | 3 | GPIO / strapping | Nguồn hàng mở rộng KQĐ | 3.3 V | Giữ mức boot phù hợp; chi tiết KQĐ | H1 tr.3 §5 |
| IO46 | Mở rộng chân 2 | 46 | GPIO / strapping | Nguồn hàng mở rộng KQĐ | 3.3 V | Board kéo xuống LOW | Không để thiết bị ngoài đổi mức boot; H1 tr.3 §5 |
| IO45 | Mở rộng chân 3 | 45 | GPIO / strapping | Nguồn hàng mở rộng KQĐ | 3.3 V | Board kéo xuống LOW | Không để thiết bị ngoài đổi mức boot; H1 tr.3 §5 |

## Tất cả chân đầu nối được tài liệu mô tả

| Đầu nối | Chân 1 | Chân 2 | Chân 3 | Chân 4 | Chân 5 | Chân 6 | Nguồn |
|---|---|---|---|---|---|---|---|
| Motor M1-M6 | OUT2 | OUT1 | N/A | N/A | N/A | N/A | H1 tr.1 §1 |
| Encoder 1 | GND | 3.3 V | A GPIO1 | B GPIO2 | N/A | N/A | H1 tr.2 §3.1 |
| Encoder 2 | GND | 3.3 V | A GPIO4 | B GPIO5 | N/A | N/A | H1 tr.2 §3.1 |
| I2C (cả 2 cổng) | GND | +5V_Core | SDA GPIO8 | SCL GPIO9 | N/A | N/A | H1 tr.2 §3.2, tr.3 §6 |
| UART0 | GND | +5V_Core | TX GPIO43 | RX GPIO44 | N/A | N/A | H1 tr.2 §3.3, tr.3 §6 |
| UART1 | GND | +5V_Core | TX GPIO6 | RX GPIO7 | N/A | N/A | H1 tr.2 §3.3, tr.3 §6 |
| SPI | GND | +5V_Core | SCK GPIO12 | MOSI GPIO11 | MISO GPIO13 | CS GPIO10 | H1 tr.2 §3.4, tr.3 §6 |
| Mở rộng | GPIO3 | GPIO46 | GPIO45 | UART1 TX GPIO6 | UART1 RX GPIO7 | SPI CS GPIO10 | H1 tr.2 §3.3-4, tr.3 §5 |
| Servo, hàng signal | GPIO14 | GPIO15 | GPIO16 | GPIO17 | GPIO18 | GPIO21 | H1 tr.1 §2 |
| Servo, hàng nguồn | +5V_Servo | +5V_Servo | +5V_Servo | +5V_Servo | +5V_Servo | +5V_Servo | H1 tr.1 §2 |
| Servo, hàng GND | GND | GND | GND | GND | GND | GND | H1 tr.1 §2 |

USB DN/DP được ghi ở bảng bus. H2 nêu XT30/jack DC nhưng không cung cấp số chân/cực tính; không tự thêm. LED nguồn/motor và công tắc động lực được nêu nhưng không có GPIO điều khiển riêng trong PDF.

## Ràng buộc cần giữ

- GPIO19/20 dành USB; GPIO6/7 là UART1; GPIO8/9 là I2C. Không thay bằng pin ví dụ từ thư viện/toolbox.
- GPIO0/3/45/46 là strapping; chỉ GPIO45/46 được H1 xác nhận kéo LOW trên board.
- Các net trùng ở đầu mở rộng là alias, không phải tài nguyên độc lập. Không mắc hai nguồn TX vào cùng RX.
- UART TX/RX đấu chéo. Việc chọn UART1 cho PS4 và để nguồn +5V_Core chưa nối sang bridge là quyết định U1, được ghi riêng tại [HARDWARE.md](HARDWARE.md).
- Các xung đột với mã hiện có được phân tích tại [báo cáo audit](../PHASE01_AUDIT.md), không thay đổi dữ liệu bảng nguồn này.

## Firmware mapping Phase 02.2 — 2026-11-05

Không thay đổi pinout. `firmware/mainboard/BoardConfig.h` hiện biểu diễn 39 net GPIO duy nhất, cả UART0 và các strapping pins. EN là reset phần cứng, không là số GPIO. Expansion TX6/RX7/CS10 và hai đầu I2C là các alias/shared nets, không tính là trùng quyền sở hữu độc lập. Startup chỉ thao tác 12 motor inputs, buzzer26 và sáu servo INPUT không pull; không chạm USB, UART/I2C/SPI, encoder hay strapping. Xem [báo cáo kiểm thử](../verification/PHASE02_2_TEST_REPORT.md). Chưa đo mức chân trên PCB.
