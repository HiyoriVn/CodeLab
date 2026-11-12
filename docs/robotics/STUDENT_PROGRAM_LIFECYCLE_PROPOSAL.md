# Đề xuất tách chương trình Blockly khỏi ARM motor

Ngày: 2026-11-12. **Đang chờ chủ dự án duyệt; chưa triển khai firmware/scheduler.**
Yêu cầu mới thay cho phương án giữ ARM toàn chương trình. Bài 01–02 chưa chốt.

## Những gì mã hiện tại thực sự làm

- `firmware/libraries/CodeLabFast4wd/src/CodeLabNewmania.h`, `Board::update()`:
  chỉ gọi `startController()` khi `robot_.controllerArmed()`; Share gọi
  `scheduler_.stop()`, mất link gọi `scheduler_.fault(LINK_LOST)`, mất ARM gọi
  `stop()`. Vì vậy Serial/biến/Wait/logic cũng ngừng. Callback reset biến chạy
  lại mỗi lần bắt đầu RUN. Đọc cạnh nút yêu cầu `running()`.
- `CodeLabV2Scheduler.cpp`: `startController()` đồng thời khởi động script và
  `gate_.unlock(runGeneration_)`. `stop()`/`fault()` gọi `cancelAll()`: hủy cả
  continuation, Wait và motion handles. `startAuto()` cũng mở gate và có giới
  hạn 60 giây, nên không dùng nó để giả lập chương trình tự chạy vô hạn.
- `Fast4wdSchedulerGate.h`: `hardLock()` gọi `Robot::stop()`; write kiểm tra khóa
  và generation, rồi dùng đường motor hiện có.
- `CodeLabFast4wd.h`: `beginLoop()` poll receiver, `endLoop()` xử lý
  Options/Share/link, kiểm tra permission và renew watchdog; `spin()` vẫn kiểm
  tra ARM/link. GPIO, MCPWM, pin mapping, đảo chiều và kiểm tra bộ nhớ nằm ở
  runtime/driver hiện có, không cần đổi để tách chương trình.
- `I2CReceiver.h`: báo cáo cùng sequence không làm mới deadline; mất dữ liệu
  quá 250 ms trả trạng thái disconnected. Giá trị đọc là dữ liệu I²C tại S3,
  không chứng minh tình trạng Bluetooth pairing của D1.

Đây là kết quả đọc source, không phải kết quả thử robot. Không thể giải quyết
đầy đủ bằng UI hoặc bỏ một điều kiện ARM: timer và lệnh motor cũ còn phải bị hủy
độc lập, và trạng thái DONE không được tự khởi động lại chương trình.

## Phương án đề xuất: runtime mới có lựa chọn rõ ràng

Giữ `newmania-v1` và `CodeLabNewmania.h` hiện tại để dự án cũ không bị đổi hành
vi âm thầm. Dự án mới dùng `programModel: newmania-v2` trong envelope project
version 1. Khi mở v1, giữ source, biến, block IDs, board và runtime v1; chỉ tạo
bản sao v2 khi người dùng xác nhận. Không tự chuyển đổi dự án cũ.

Tạo facade mới `CodeLabStudentProgram.h` dùng receiver, Robot, motor driver và
scheduler đang có. Hai trạng thái độc lập:

| Chương trình học sinh | Quyền motor |
| --- | --- |
| BOOT → RUN đúng một lần, không cần PS4 | Boot: LOCKED |
| DONE giữ DONE; không tự restart | Options mới, link mới và điều kiện trung tính hợp lệ: ARMED |
| Share/mất link không hủy Serial, biến hoặc timer Wait | Share/mất link/stale report: khóa, dừng, hủy mọi lệnh motor |
| Lỗi thực thi/heartbeat vẫn có thể FAULT toàn chương trình | Reconnect giữ khóa tới lần ARM rõ ràng tiếp theo |

Mỗi boot chỉ reset biến một lần. Options ARM không reset biến hoặc khởi động lại
logic; Share chỉ dừng motor trong v2. Đây là thay đổi hành vi có chủ đích, nên
cần nhãn model và xác nhận khi chuyển dự án cũ.

### Thứ tự mỗi lượt update

1. Poll I²C và lấy freshness/Share trước callback học sinh.
2. Nếu motor cần khóa: đưa output về dừng bằng đường hiện có; xóa ý định drive,
   timer motor và ownership đang chờ. Không thay đổi program counter, biến,
   timer Wait thông thường hay generation chương trình.
3. Chạy safety phase và callback hữu hạn của chương trình, kể cả chưa có link.
   Đọc trạng thái/nút/trục không yêu cầu ARM. Khi disconnected: connected=false,
   nút=false, trục=0; cạnh cũ không được phát lại sau reconnect.
4. Mọi lệnh motor kiểm tra quyền riêng tại lúc ghi; không xếp hàng lệnh bị từ
   chối để phát lại sau ARM. Mỗi generation quyền motor mới không nhận lại lệnh
   hoặc handle cũ. Các macro tương thích v2, nếu được chuyển có xác nhận, cũng
   phải đi qua cùng gate; không được có đường tắt qua cached drive intent.
5. Gọi điều khiển/watchdog/Serial drain hiện có. Không chặn bằng delay học sinh,
   không chờ USB để tiếp tục vòng lặp.

Khi motor timed-wait bị hủy bởi STOP/link: hủy handle, đánh thức continuation
đó để tiếp tục phần không tác động motor. Motor command khi đang khóa là no-op
có trạng thái từ chối, không làm FAULT toàn chương trình. Wait thời gian thường
giữ đúng deadline. Không coi handle=0 do bị khóa là lỗi chương trình; handle=0
do dữ liệu/API sai vẫn phải có diagnostic phù hợp.

Vòng lặp phát lệnh motor mới sau lần Options ARM hợp lệ có thể chạy motor; yêu
cầu là **reconnect không tự ARM** và không phát lại lệnh cũ. Không bổ sung yêu
cầu phải nhả/nhấn lại D-pad sau ARM nếu chưa có quyết định sản phẩm khác.

### File dự kiến thay đổi nếu được duyệt

| File | Thay đổi dự kiến |
| --- | --- |
| `firmware/libraries/CodeLabFast4wd/src/CodeLabStudentProgram.h` (mới) | Facade v2: tự chạy một lần sau boot, trạng thái PS4 độc lập, callback/Serial/Wait tiếp tục, gate motor riêng |
| `firmware/libraries/CodeLabFast4wd/src/StudentMotorGate.h` (mới) | Kiểm tra quyền motor/freshness/Share và generation quyền; dùng đường motor hiện có, xóa lệnh khi khóa |
| `firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.hpp` và `.cpp` | API opt-in bắt đầu chương trình mà không mở quyền motor; hủy motion handles riêng mà không cancel script; tách generation quyền motor nếu cần. `startAuto`, `startController`, `stop`, `fault` cũ giữ contract mặc định |
| `src/blocks/newmania.js`, `src/generators/newmania.js`, `src/generators/arduino.js` | Nhận model v2 và chọn facade mới; giữ thuật toán scheduler C++ hiện tại. Không viết lại cấu trúc generator để rút ngắn preview |
| `src/ui/newmania-project.js`, `src/App.jsx` và project validation | Model mới cho dự án mới; cảnh báo v1; chuyển bản sao có xác nhận, giữ nguyên dữ liệu gốc |
| `src/lessons/newmania.js` và fixtures bài mẫu | Hoàn thiện bài 01 Serial 0,5 giây tự chạy và bài 02 in thay đổi connected/disconnected; bài 03–05 dùng motor gate v2 |
| `public/toolchain-337/codelab-poc-data.json` và manifest/revision | Đồng bộ đúng thư viện v2 cho WASM. Worker hiện đọc source thư viện từ JSON này, không trực tiếp từ `firmware/libraries` |
| `src/compiler/browser-compiler.worker.js` nếu cần | Gắn revision/hash thư viện vào danh tính build/cache để không nhầm binary giữa hai runtime cùng Core 3.3.7; giữ nguyên luồng compile/flash |
| tests/docs | Host test thực thi C++ thật, regression v1, Chrome WASM/validatePackage, cập nhật hướng dẫn và kết quả thực tế |

Giữ nguyên `CodeLabNewmania.h` v1, `CodeLabFast4wd.h`,
`Fast4wdSchedulerGate.h` cũ, QuadMotors/MCPWM, BoardConfig/profile/GPIO,
firmware D1, các sketch baseline đã kiểm thử và giao thức I²C. Nếu kiểm tra triển
khai phát hiện phải sửa các file bị đóng băng này, phải dừng và xin duyệt phạm
vi mới. Scheduler dùng chung chỉ được thêm behavior opt-in và phải qua toàn bộ
regression mặc định. Không tạo bản sao driver/scheduler độc lập.

## Kiểm thử bắt buộc trước khi công bố hoàn tất

1. Không PS4: boot → `dem=0`, mỗi 500 ms tăng/in; variable/if/loop/Wait hoạt động.
2. Chưa ARM: đọc connected/nút/trục được; motor PWM luôn 0, timed motor không
   tạo handle có thể sống lại. Pair/reconnect đơn thuần không cho motor chạy.
3. PS4 connect/disconnect: Blockly tiếp tục, biến không reset, in đúng hai trạng
   thái; log chỉ dựa trên freshness I²C, không gọi Bluetooth pairing.
4. Share và mất link trong Wait, vòng lặp, từng motor, timed motor, macro cũ có
   xác nhận chuyển: motor dừng qua gate, hủy lệnh/handle, không tự chạy lại.
5. Report giữ nguyên sequence, 250/251 ms, counter wrap, frame lỗi, mất bus,
   reconnect giữ Options và nút giữ: không ARM/không phục hồi lệnh cũ.
6. Hết chương trình không restart; fault thật/heartbeat vẫn khóa motor; USB
   Serial nghẽn không chặn safety. Wait bị hủy không kẹt và không bỏ qua gate.
7. Dự án v1 và golden cũ không đổi; v2 save/export/import giữ model và ID; build
   v1/v2 đúng board và đúng source thư viện; đổi block/revision làm build cũ vô hiệu.
8. `npm test`, `npm run build`, Chrome Core 3.3.7 và `validatePackage`; không flash.

“Dừng ngay” là xử lý ở lượt safety kế tiếp của vòng update hiện có. Đây không
phải bảo đảm ngắt cứng độc lập CPU. Không tuyên bố hardware PASS hoặc thời gian
dừng vật lý khi chưa đo trên robot.

## Quyết định cần chủ dự án duyệt

Cho phép triển khai runtime v2 + phần mở rộng scheduler opt-in + model project
v2 + đồng bộ payload WASM như bảng trên, giữ nguyên baseline v1/driver/D1/profile?
Share chỉ khóa motor và tiếp tục logic; Options chỉ ARM motor, không restart
chương trình. Chưa triển khai các thay đổi đó trước khi có câu trả lời.
