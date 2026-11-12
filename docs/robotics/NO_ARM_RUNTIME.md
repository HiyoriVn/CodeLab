# CodeLab tự chạy, không Options ARM

> Quyết định mới nhất bỏ cả **Options ARM và Share STOP**. Các đề xuất dùng
> Share hoặc khóa tới reset dưới đây đã bị hủy; xem
> [phạm vi sửa tối thiểu hiện hành](NO_ARM_NO_SHARE_SCOPE.md).

Ngày 2026-11-12. Quyết định của chủ dự án: bỏ yêu cầu Options ARM cho cả
chương trình Blockly và motor. **Đang kiểm tra thiết kế; chưa sửa runtime.**
Đây là thay đổi trên nhánh `test/integration-ui-wasm-newmania`, không phải một
board mới, không có lựa chọn board V1/V2 hoặc block/nút xác nhận ARM mới.

## Kết quả kiểm tra source

| Tầng | Phụ thuộc hiện tại | Hướng sửa cần thiết |
| --- | --- | --- |
| `CodeLabNewmania.h` | Đợi `controllerArmed()` mới start; Share/mất ARM dừng scheduler; link lost fault toàn chương trình | Chạy chương trình đúng một lần sau boot; không reset biến khi link đổi; STOP motor độc lập với Serial/Logic/Wait |
| `CodeLabV2Scheduler.hpp/.cpp` | Bắt đầu RUN mở motor gate; stop/fault hủy mọi script và motion handle | Chế độ chương trình tự chạy; hủy motion handles mà giữ continuation không tác động motor; vẫn fault khi loop stall/lỗi callback |
| `Fast4wdSchedulerGate.h` | Gọi `Robot::spin/stopMotor`; generation chống write cũ | Giữ kiểm tra generation/ownership; gate mới hoặc chế độ riêng cho Blockly, không bypass mọi gate |
| `CodeLabFast4wd.h` | `canCommand` và `endLoop` yêu cầu ARMED + fresh PS4; Options yêu cầu neutral; mixer luôn gắn `RobotController` | Chính sách Blockly không ARM, tách motor tự động và motor phụ thuộc PS4; mặc định legacy giữ cho các client/demo cũ |
| `QuadMotors.h`, `SingleMotor.h`, `Esp32Mcpwm.h` | Permission ghi output, PWM LOW khi chưa có quyền, giới hạn thời gian/renew và kiểm tra bộ nhớ/phần cứng | Giữ source và thông số; runtime cấp/renew quyền chỉ cho lệnh hợp lệ, revoke khi safety yêu cầu |
| Blockly generator | Luôn dựng facade cũ; yêu cầu controller.enabled dù không đọc PS4; timed-wait handle=0 gây fault toàn chương trình | Sinh chế độ no-ARM và dependency metadata rõ; không yêu cầu PS4 với chương trình tự động; lệnh motor bị safety từ chối không giết chương trình |
| WASM worker | Thư viện lấy từ JSON đóng gói, cache object theo lib/path; build ID từ sketch/board/toolchain version | Đồng bộ source và revision/hash thư viện; không nhầm binary cũ; không đổi kiến trúc compile/flash |

Không thể chỉ thay `controllerArmed()` bằng true: `RobotController` vẫn dừng output
khi mất PS4, và Share/reset có thể để lại timer hoặc ý định motor bị phát lại.
Không dùng Options nội bộ để giả lập ARM. Không disable PSRAM hoặc đổi pin để
giải quyết phần mềm.

## Hành vi đã được chủ dự án yêu cầu

- BOOT → Khi bắt đầu chương trình → logic chạy tự động. DONE không tự restart.
- Motor LOW lúc boot; chỉ lệnh hợp lệ mới cho phép output.
- Motor tự động không PS4: không bị freshness I²C/Bluetooth chặn.
- Đọc trạng thái/nút/joystick không cần ARM; không tự pair Bluetooth.
- Share/mất PS4 phải được xử lý cả khi chương trình Wait hoặc lặp. Không chặn
  vòng safety bằng Wait học sinh, ghi Serial hoặc timed-motion wait.
- Motor command/timer/drive intent cũ phải bị xóa khi STOP hoặc mất link liên
  quan; chương trình vẫn có thể in `PS4 DISCONNECTED`.
- Giữ nguyên baseline demo, FQBN, GPIO, MCPWM, I²C, D1, motor config và chiều.
- Không deploy/flash. Chỉ software/native/Chrome compile acceptance.

## Ba quyết định đang chờ xác nhận trước khi sửa

1. **PS4 sau Share/mất link:** đề xuất xóa toàn bộ lệnh motor, đợi report mới
   trung tính, sau đó chỉ mở lại khi có thao tác điều khiển mới. Trung tính nghĩa
   là nhả nút điều khiển và đưa các trục đang sử dụng về deadzone. Poll lặp lại
   không tạo report mới. Không cần Options/ARM. Phương án khác: khóa tới reset.
2. **Motor tự động sau Share:** đề xuất khóa tới reset board. Thả Share không
   đủ để lệnh hằng hoặc vòng lặp khởi động motor lại. Nếu tay cầm không có mặt,
   không thể nhận nút Share; không diễn giải đây là nút dừng vật lý độc lập.
3. **Chương trình hỗn hợp:** đề xuất tạm phân loại toàn dự án: có đọc PS4 thì
   mọi motor chịu safety PS4; không đọc thì tự động. Lựa chọn khác là theo dõi
   dependency từng lệnh, bao gồm dữ liệu qua biến, điều kiện, loop và Wait; không
   được chỉ nhìn việc motor block có nằm trực tiếp trong if nút PS4 hay không.

Việc bảo toàn dự án cũ và thay đổi chính sách thực thi phải được mô tả rõ khi
triển khai; giữ workspace format, block/variable IDs và board. Không âm thầm
thay pin hoặc xóa macro cũ. Nếu cần thêm metadata runtime nội bộ thì metadata
đó không phải board mới hay một bước ARM trong UI.

## Kiểm thử cần bổ sung sau khi chốt quy tắc

- Serial Counter và motor tự động boot không có PS4/Options; controller disabled,
  I²C unavailable và PS4 disconnected không chặn chương trình tự động.
- Mỗi motor, cả chiều/công suất, timed wait/no-wait; boot output 0; CPU heartbeat
  và lỗi backend vẫn dừng; không mất giới hạn PWM hay memory checks.
- PS4 connect/status/button/axis trước khi có link và sau mất link; biến không
  reset; nhận report cũ không refresh watchdog; biên 250/251 ms và wrap.
- Share trong mọi kiểu Wait/vòng lặp; thả Share khi D-pad vẫn giữ; reconnect
  joystick lệch/nút giữ; neutral rồi thao tác mới; không phát lại timer/intent.
- Dự án hỗn hợp theo đúng quyết định được xác nhận; snapshot/import/export và
  source dependency deterministic; không vô tình chặn motor tự động.
- Regression demo/driver/profile byte equality, npm test, production build,
  Chrome WASM Core 3.3.7, validatePackage và build invalidation.

## Chuẩn bị kiểm chứng đã thực hiện

Đã sửa runner Chrome để tạo profile tạm riêng dưới
`firmware/tests/build-output`, thay việc xóa một profile hard-code ngoài repo.
Runner không cần `--no-sandbox`. Chưa sửa source runtime/generator/driver.

Đã so sánh 18 file thư viện trong `codelab-poc-data.json` với source hiện tại:
chỉ ba header driver khác BOM đầu file; sau bỏ BOM/chuẩn hóa CRLF thì nội dung
khớp. Đây là audit source, không phải hardware PASS.

Chrome headless 157 / Core 3.3.7 baseline: **PASS**, process exit 0. Bốn chương
trình hiện tại đã biên dịch và qua `validatePackage`: giữ X chạy M1 (342944 byte),
đếm X (342976), joystick mecanum cũ (342704), Wait/vòng lặp (342336). Runner còn
kiểm tra build ID đổi khi source đổi, báo lỗi C++ và lỗi tài nguyên không tồn
tại. Kết quả này là mốc **trước thay đổi no-ARM**, không xác nhận behavior mới.
Report và log nằm dưới `firmware/tests/build-output`:
`blockly-wasm-verification-report.json`, `wasm-baseline-before-no-arm.log`.
