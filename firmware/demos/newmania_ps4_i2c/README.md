# Issue20 — PS4 I2C mecanum demo (compile PASS, hardware untested)

**Hai firmware mới:** D1 `firmware/ps4_i2c_bridge/ps4_i2c_bridge.ino`; S3 `newmania_ps4_i2c.ino` tại thư mục này. Không cần UI Blockly mới. Motor/servo chỉ mock, không GPIO actuator/PWM. BOM người dùng xác nhận N16R8 và4 RZ7899-MS; giữ OPI, không dùng35–37, không loại driver onboard khỏi thiết kế.

## Dây đúng

| ESP32 D1 — slave | S3 Newmania — master |
|---|---|
| SDA GPIO22 | SDA GPIO8 |
| SCL GPIO21 | SCL GPIO9 |
| GND | GND |

Không đấu chéo SDA/SCL, không dùng phương án UART21/22→21/18 của task trước. Test đầu chỉ USB, rút motor/servo, không DC ngoài; không nối5V giữa hai board. Pull-up tín hiệu phải về3.3V. Bus100kHz, địa chỉ mặc định **0x30**; đổi địa chỉ phải build cả hai cùng `-Address`.

## Khác code bạn gửi

Đã đọc `C:/Users/Admin/Downloads/ps4ble_newmania_firmware.ino`, SHA256 `916AF49B517E29C3B9CCD39BC52703E32F0118E6B09A12F82454E91057E1F73C`: dùng0x55, payload ASCII nhiều trường và không chọn rõ chân22/21. File gốc không bị sửa. Bản mới giữ `ps4::begin()`, PS4Bluepad321.0.1/NVS/pairing/MAC và reset `r/R` tường minh (USB hoặc I2C receive, xử lý ngoài callback). Không reset MAC khi boot, không Web Pairing, không Bluetooth mới. Mapping/deadzone/Y/bit buttons dùng lại A2–A4; thư viện ngoài không vendored.

Wire format vẫn13 byte: flags, LX/LY/RX/RY int16 LE, buttons uint32 LE. Flags bit0=connected, bits1..7=sequence modulo128. Chỉ report Bluetooth mới hợp lệ tăng sequence, kể cả giá trị không đổi; polling/onRequest không tăng. Callback copy snapshot13 byte nguyên khối có khóa, không gọi Bluetooth; kiểm tra tuổi report ở slave, preload FIFO ban đầu theo Core4.1.0 WireSlave example.

S3 chỉ làm mới deadline khi sequence tiến1..63 modulo128. Frame đầu làm baseline; bước nhảy mơ hồ rebase; lỗi bus/frame hay cùng sequence nhưng khác payload neutralize. Sau timeout, frame đầu chỉ làm baseline lại. Lặp cache không hồi sinh lệnh. Quá250ms không có sequence mới: neutral và latched FAULT, kể cả đang DISARMED; đúng250ms còn hợp lệ. Reconnect không auto-arm. Watchdog đo tại lúc S3 thấy sequence mới, có độ trễ polling/bus;7bit không có CRC/epoch/chống replay. Không dùng legacy Blockly I2C decoder (bỏ qua sequence) để thay receiver này.

## Build đã chạy

| Target | Core / FQBN | Program / globals / BIN B | Kết quả |
|---|---|---|---|
| D1 slave | Bluepad32 4.1.0, `esp32-bluepad32:esp32:esp32` | 725845 /87460 /732416 | PASS exit0 |
| S3 master | ESP32 3.3.7, `esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=opi,USBMode=hwcdc,CDCOnBoot=cdc` | 341666 /24164 /341808 | PASS exit0 |

CLI1.5.1; `npm test`39/39 PASS, `npm run build` PASS. Host tests cover LE/goldens, sequence/cache/identical fresh reports/127→0,250/251ms/clock wrap, lỗi bus/torn payload/quarantine,201 giá trị trục và mecanum/servo mock/FAULT/re-arm. Logs/hash/commands local: `docs/verification/ps4_i2c_d1_compile.log`, `ps4_i2c_s3_compile.log`; build-output và logs ignored. Chưa upload/đọc I2C thật trong task này.

Build lại tại workspace:
```powershell
node tools/i2c-demo-headers.mjs
pwsh -NoProfile -File tools/verify-i2c-demo.ps1 -Target D1
pwsh -NoProfile -File tools/verify-i2c-demo.ps1 -Target S3
```

## Bạn chủ động nạp khi sẵn sàng

Chọn đúng cổng riêng từng board; S3 trước đây COM4 nhưng phải kiểm tra lại, không mặc định D1 cũng COM4. Đóng Serial Monitor trước nạp. Điền hai placeholder COM bên dưới rồi tự chạy; agent chưa chạy các lệnh này. **Nạp cả D1 và S3**, không dùng image0x55/ASCII cũ.
```powershell
$cli='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$d1Port='COM_D1'; $s3Port='COM_S3' # Thay bằng cổng bạn đã xác nhận
& $cli upload --fqbn esp32-bluepad32:esp32:esp32 --port $d1Port --input-dir firmware/ps4_i2c_bridge/build-output firmware/ps4_i2c_bridge
& $cli upload --fqbn 'esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=opi,USBMode=hwcdc,CDCOnBoot=cdc' --port $s3Port --input-dir firmware/demos/newmania_ps4_i2c/build-output firmware/demos/newmania_ps4_i2c
```

Mở USB Serial S3 **115200**. Khi PS4 đã nối D1 và có report mới:
```text
MOCK_ONLY connected=1 seq=... LX=... LY=... RX=... RY=... buttons=... FL=... FR=... RL=... RR=... servo_target=90.0 enabled=0 DISARMED ... fresh=... repeats=... errors=0
```
Nếu đã FAULT lúc chưa có dữ liệu: thả stick/D-pad, nhấn PS (hoặc USB `c`) để clear; Options khi neutral để arm **mock**, Share/USB `d` disarm. Sau arm, stick làm thay đổi FL/FR/RL/RR mock (cap0.15). USB `s` chỉ enable servo **mock** sau arm; D-pad Up/Down đổi target45..135°/30°s. Không phát xung servo thật.

Ngắt tay cầm/đóng băng sequence: phải về `connected=0`, axes/buttons/wheels0, servo disabled, `FAULT`; nối lại không tự arm. Nếu `errors` tăng liên tục, kiểm tra đúng hai image0x30, SDA/SCL/GND và pull-up3.3V. Nếu chỉ `repeats` tăng/fresh đứng yên, kiểm tra report Bluetooth mới; không sửa receiver để coi cache là fresh.

Chưa điều khiển thật: mapping đủ4 motor còn xung đột35–37; nguồn/chân/giới hạn servo chưa được xác minh. Driver RZ7899-MS vẫn giữ trong thiết kế, không đề xuất driver ngoài. Tiếp theo là thử giao tiếp theo hướng dẫn bằng thao tác nạp của người dùng, chưa phải test tải.

## Commit-ready

19 file: hai sketch, shared codec/receiver + A2 headers derived, controller link-fault hook, tests, compile/header tools và tài liệu. Board profiles, UART firmware và library pairing source không đổi. Binary/ELF/map/build-output, raw ps4_i2c_*.log và host logs ignored. Không commit/push bởi agent.

```powershell
git add -- .gitignore AGENTS.md README.md docs/PROGRESS.md docs/PS4-RECEIVER.md docs/TESTING.md firmware/demos/newmania_ps4_i2c/README.md firmware/demos/newmania_ps4_i2c/newmania_ps4_i2c.ino firmware/libraries/CodeLabPs4I2C/library.properties firmware/libraries/CodeLabPs4I2C/src/I2CFrame.h firmware/libraries/CodeLabPs4I2C/src/I2CReceiver.h firmware/libraries/CodeLabPs4I2C/src/MappingPublisher.h firmware/libraries/CodeLabPs4I2C/src/ReportGate.h firmware/libraries/CodeLabRobot/src/RobotController.h firmware/ps4_i2c_bridge/ps4_i2c_bridge.ino tests/i2c-native.cpp tests/i2c.test.mjs tools/i2c-demo-headers.mjs tools/verify-i2c-demo.ps1
git diff --cached --check
git commit -m "feat(ps4): add sequence-aware I2C mecanum demo"
git push origin HEAD
```
