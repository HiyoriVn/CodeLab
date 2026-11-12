# Tự chạy Blockly, không Options ARM hoặc Share STOP

2026-11-12 — nhánh `test/integration-ui-wasm-newmania`.
**Đã được chủ dự án duyệt và triển khai theo ba lựa chọn xác nhận.**
Kết quả hiện hành: [báo cáo tích hợp](../verification/INTEGRATION_UI_WASM_NO_ARM.md).
Các mục “cần chốt” dưới đây giữ lại nội dung đã được duyệt để truy vết quyết định.

Quyết định mới nhất của chủ dự án thay thế toàn bộ đề xuất dùng Share hoặc khóa
motor tới reset trước đó. Không thêm `newmania-v2`, board mới, selector V1/V2,
block ARM hoặc bước xác nhận ARM trên UI.

## Kết luận rà soát

Cần sửa firmware **thư viện**; chỉ sửa UI hoặc facade là không đủ:

- `CodeLabNewmania.h::update()` đợi controller ARM để start và dừng/fault toàn
  chương trình khi Share/mất link. `canCommand()` cũng kiểm tra Share/ARM/link.
- `CodeLabFast4wd.h::canCommand()` và `endLoop()` có một lớp ARM/Share độc lập:
  `controls_.requests`, `button(8)`, `controller_.tick()` và cấp/renew permission
  dựa trên trạng thái ARMED. Nếu giữ đường này, motor không PS4 vẫn không chạy.
- Scheduler `stop()`/`fault()` gọi `cancelAll()`, hủy cả chương trình, Wait và
  motion handles. Mất PS4 cần hủy motor handles riêng, không hủy logic.
- Generator mới `newmania.js` luôn yêu cầu controller enabled. Đường generator
  dự án cũ `v2-scheduler.js` cũng sinh trực tiếp Share/ARM/link-stop. Phải sửa cả
  hai đường dùng cho chương trình Blockly Newmania để không sót điều kiện.
- LED đã có hành vi cần giữ: trong `Robot::endLoop()`, fresh link sáng liên tục;
  mất link đổi mức mỗi 250 ms. Dùng freshness I²C tại S3, không suy diễn Bluetooth
  pairing ở D1; poll cùng sequence không kéo dài deadline 250 ms.

## Phạm vi sửa tối thiểu đề xuất

| File/nhóm | Thay đổi |
| --- | --- |
| `firmware/libraries/CodeLabFast4wd/src/CodeLabNewmania.h` | Khởi chạy một lần sau boot, giữ biến/logic khi mất PS4; bỏ mọi tác động hệ thống của Options/Share; quản lý mất link riêng với motor |
| `firmware/libraries/CodeLabFast4wd/src/CodeLabFast4wd.h` | Đường thực thi Blockly không qua Options/Share hoặc ARM trong RobotController. Cấp output theo lệnh hợp lệ, heartbeat và loại chương trình; xóa output/intent ngay khi mất link liên quan. Giữ đường mặc định cho client/demo baseline cũ; lựa chọn này chỉ là API nội bộ, không xuất hiện trong UI |
| `firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.hpp` và `.cpp` | Bắt đầu chương trình tự động đúng một lần; API hủy motion handles mà không hủy script hoặc timer Wait thường. DONE không tự restart. Giữ lỗi heartbeat/callback/backend khóa output |
| `firmware/libraries/CodeLabFast4wd/src/Fast4wdSchedulerGate.h` | Revoke output và ownership khi mất link; giữ kiểm tra generation, bỏ nguy cơ timer cũ dừng/ghi nhầm lệnh mới |
| `src/generators/newmania.js`, `fast4wd.js`, `v2-scheduler.js` | Sinh đường không ARM/Share cho Blockly mới và tương thích; xác định chương trình có phụ thuộc PS4, không bắt controller enabled cho autonomous; bảo toàn block/biến/ID và workspace format |
| UI/tooltips/examples/tests/docs | Bỏ thông tin ARM/Share STOP cũ, giữ LED; bài 01 tự chạy, bài 02 quan sát connect/disconnect. Hiển thị rõ chính sách thực thi mới khi mở dự án cũ; không thêm model/board mới |
| `public/toolchain-337/codelab-poc-data.json`, manifest và cache/build identity nếu cần | Đồng bộ source thư viện và revision/hash để Chrome biên dịch đúng thư viện; giữ pipeline compile → USB và Core 3.3.7 |

Giữ nguyên byte/source của `QuadMotors.h`, `SingleMotor.h`, `Esp32Mcpwm.h`,
`RobotController.h`, driver/mapping I²C, firmware D1, board profile/FQBN,
cấu hình và đảo chiều motor, các file dưới `firmware/demos` và baseline đã thử.
Không giả lập nút Options, không tự ARM nội bộ rồi giữ cơ chế cũ chạy ngầm.
Runtime mới dùng permission thấp của driver theo lệnh hợp lệ; đó không phải một
bước ARM của người dùng. Scheduler/driver heartbeat vẫn được giữ.

Chương trình Blockly cũ khi biên dịch lại sẽ theo chính sách không ARM/Share;
đây là thay đổi hành vi được yêu cầu, cần cập nhật goldens và thông báo rõ.
Firmware đã nạp trước đó và sketch demo baseline không bị thay đổi bởi việc mở
hoặc sửa project trong web; task không flash.

## Hai điểm hành vi cần chốt

### Dự án hỗn hợp

Ví dụ: đầu chương trình chạy M1 tự động; vòng lặp sau đó đọc nút PS4 để chạy M2.
Khi PS4 mất link, giữ M1 hay dừng cả hai là hai hành vi khác nhau.

Đề xuất tối thiểu: **dự án có đọc trạng thái/nút/joystick PS4 hoặc dùng lệnh lái
PS4 thì mọi motor chịu mất-link stop; dự án hoàn toàn không dùng PS4 thì motor
độc lập**. Cấu hình controller có sẵn không tự làm dự án thành phụ thuộc PS4.
Block kết nối đơn thuần/đọc trạng thái để log có thể khiến dự án có motor được
xếp nhóm PS4; cần chủ dự án đồng ý, không được tự suy đoán động cơ nào liên quan.

Theo dõi dependency từng motor là lựa chọn khác, nhưng phải truyền qua biến,
nhánh, loop và Wait; không thể chỉ xét motor block nằm dưới if đọc nút.

### Reconnect không chạy lại lệnh cũ

Đề xuất: mất link hủy PWM, timer motor, motion handles, cached drive intent và
cạnh nút cũ. Khi có report mới trở lại, giữ motor dừng nếu nút còn giữ/joystick
còn lệch; đợi trung tính rồi nhận thao tác mới ở report sau. Không chờ Options,
Share hoặc reset. Tiếp tục đọc/in trạng thái trong toàn bộ giai đoạn này.

Đây là quy tắc chống phát lại khi reconnect, không phải bước ARM. Options/Share
không có đặc quyền hệ thống; nếu sau này có block đọc chúng thì chỉ là dữ liệu
cho logic học sinh.

Timer Wait thường tiếp tục đúng deadline. Wait đang chờ motor kết thúc được
đánh thức khi handle bị hủy để logic có thể tiếp tục; lệnh motor mới trong lúc
mất link/reconnect chưa sẵn sàng bị từ chối, không xếp hàng để phát lại.

## Kế hoạch kiểm chứng sau khi được duyệt

1. Boot/no PS4: Serial/biến/loop/Wait và motor autonomous hoạt động, PWM ban đầu 0.
2. Options và Share ở mọi trạng thái không start/stop/reset/khóa output hệ thống.
3. Mất PS4 trong motor thường/timed/Wait/vòng lặp: toàn bộ motor của chương trình
   PS4 dừng, intent/handles cũ bị hủy; logic/Serial/biến tiếp tục.
4. Reconnect nút giữ/joystick lệch không chạy; neutral rồi thao tác mới chạy;
   cùng sequence không refresh watchdog; kiểm tra 250/251 ms và wrap.
5. LED sáng khi fresh, nhấp nháy khi disconnected, kể cả trước kết nối lần đầu.
6. Dự án hỗn hợp theo chính sách chủ dự án chọn; autonomous không bị watchdog PS4.
7. Host thực thi C++, regression legacy, byte equality baseline/driver/profile,
   `npm test`, build, Chrome WASM 3.3.7, validatePackage và build invalidation.

Runtime/scheduler/generator đã được sửa trong phạm vi được duyệt. Kết quả phần
mềm hiện hành được ghi ở báo cáo tích hợp; baseline Chrome bốn chương trình là
mốc lịch sử. Không merge main/deploy/flash hoặc tuyên bố hardware PASS.
