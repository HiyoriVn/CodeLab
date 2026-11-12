# UI/WASM + Blockly tự chạy — kết quả tích hợp

Ngày 2026-11-12. Nhánh `test/integration-ui-wasm-newmania`.
**Software verified; hardware untested.** Không merge main, deploy hoặc flash.

## Nguồn và merge

Fetch lại trước khi hoàn tất xác nhận nguồn không đổi:

| Ref | HEAD |
| --- | --- |
| `main` | `161b4c0901f197063154ac6ca8ed75fd69387d0d` |
| `feat/ui_ux` | `366202d4be030918faf0d8533519a0d22e91a234` |
| `test/browser-wasm-newmania` | `a570a7265d33a53b2a873f71df754499579e75b4` |

Tạo nhánh từ main; UI fast-forward trước, merge WASM thành `0a8aaeb`.
Một conflict tại tiêu đề/lời dẫn modal Thiết bị: giữ title, `genie="connect"`
và animation của Bách; giữ DevicePanel hai bước của WASM. Không dùng ours/theirs
toàn file. Checkpoint UI/toolbox trước đổi runtime: `8ffd60e`.

## Quyết định chủ dự án đã duyệt

- Bỏ Options ARM và Share STOP ở cấp hệ thống cho các chương trình Blockly.
- Tự chạy Khi bắt đầu đúng một lần sau boot. DONE không tự restart; Options,
  Share, mất link hay reconnect không reset biến hoặc khởi động lại chương trình.
- Dự án có dùng PS4 thì mất link dừng **tất cả motor**, cả motor được viết bằng
  lệnh hằng trong cùng dự án. Dự án hoàn toàn không dùng PS4 thì motor độc lập.
- Reconnect phải có report mới trung tính rồi một thao tác mới. Không chờ nút
  Options/Share/reset; không phát lại PWM, timer motor, ownership hoặc drive intent cũ.
- Không thêm model `newmania-v2`, board mới hay lựa chọn chế độ UI.

Quyết định này thay các đề xuất ARM/Share trong hai tài liệu lịch sử và các
record ngày trước. Tái biên dịch dự án Blockly cũ dùng chính sách mới; dữ liệu
workspace, block/variable IDs, model `newmania-v1`, version-1 envelope và board
được giữ nguyên. UI hiển thị chính sách hiện hành, không tự upload/run.

## Runtime và generator

`CodeLabNewmania` dùng `startProgram()` một lần và không còn điều kiện
`controllerArmed()`/Share trong đường điều khiển Blockly. `Robot` có policy nội
bộ được generator chọn; đường này không gọi Options/Share mapping hoặc trạng
thái ARMED của `RobotController`. Policy cũ chỉ giữ cho client tham chiếu sử
dụng trực tiếp Robot mặc định; không phải lựa chọn UI hay bước kích hoạt mới.

`ps4-usage.js` xác định dependency khi có khối kết nối/đọc trạng thái/nút/trục
hoặc macro đọc PS4 cũ. Controller enabled trong device config đơn thuần không
làm chương trình thành phụ thuộc PS4. Masks chỉ gồm các input đang dùng; chương
trình chỉ kết nối/đọc trạng thái dùng tập điều khiển mặc định. Deadzone để nhận
trung tính là 6%; trục RY không tham gia nếu không được chương trình sử dụng.

Mất link được nhận qua receiver I²C hiện có, gồm fresh frame/sequence và timeout
**quá 250 ms**. Runtime lập tức revoke output ở lượt update xử lý mất link, xóa
commands; scheduler hủy motion handles riêng, giữ script/generation/biến/timer
Wait thường. Motion-wait thức dậy khi handle bị hủy. Lệnh bị chặn không được
xếp hàng để chạy lại và không gây FAULT cả chương trình. Lỗi heartbeat/callback
thật vẫn dừng và khóa output. Không giả lập Options để ARM ngầm.

Đường generator legacy cũng chọn policy Blockly, tự start một lần và hủy motor
intent theo epoch mất link. Vẫn giữ macro definitions/generators để đọc project
cũ, không tự xóa/chuyển block. Chỉ toolbox học sinh ẩn `robot_mecanum`,
`robot_drive_direction`, `robot_drive_for_time`, `robot_drive_stop` và nhóm di
chuyển tổng hợp; motor riêng M1–M4, power có dấu và stop vẫn có mặt.

LED GPIO47 giữ logic hiện có: fresh link sáng, mất link đảo mức mỗi 250 ms.
Đây là trạng thái PS4 được S3 nhận qua I²C, không phải thao tác pair Bluetooth
với D1. Driver GPIO/MCPWM, receiver/I²C/D1, FQBN, motor config/reversal, board
profile và demo baseline không đổi. Đối chiếu Git các đường được bảo vệ không
có diff. Không suy diễn board N16R8/Octal an toàn để drive GPIO35–37.

## Năm bài mẫu

| Bài | Blockly | App binary Chrome WASM |
| --- | --- | ---: |
| 01 Serial Counter | `dem=0`, Wait 0,5 giây, tăng 1, in Serial; không PS4/LED học sinh | 344432 byte |
| 02 PS4 Connection | Connect riêng, kiểm tra connected, in đổi trạng thái CONNECTED/DISCONNECTED qua I²C S3 | 344560 |
| 03 Từng motor | D-pad → từng M1–M4 50%, thả dừng; L1 PRESS đảo dấu một lần | 345040 |
| 04 Bốn bánh | D-pad tiến/lùi/xoay, 30%, công suất riêng từng motor | 344928 |
| 05 Hai joystick | LY tiến, LX xoay, RX ngang; biến/toán/deadzone 6%/chuẩn hóa peak/clamp ±100 | 346304 |

Vị trí bánh FL/FR/RL/RR và đảo M1/M2 lấy từ registry/MotorLayout/MecanumMixer
hiện có; không suy đoán lại GPIO hoặc đảo dấu hai lần. Các bài dùng block
riêng, không macro. JSON và `.ino` deterministic dưới `examples/newmania/lessons`.
Tái sinh: `node tools/student-lessons.mjs`. Các fixture Newmania trước đó và ba
sketch legacy cũng được đồng bộ generator; demo firmware không bị tái sinh.

## WASM và checks đã chạy

- `npm test`: **137/137 PASS**, exit 0; `npm run build`: **PASS**, exit 0.
  Cảnh báo Blockly deprecated API và Vite chunk >500 kB còn tồn tại.
- Host C++ dùng g++ C++17 `-Wall -Wextra -Werror`, actual receiver/scheduler/
  runtime/driver với platform mocks: boot/no PS4, motor autonomous, individual
  buttons/readers/sequence wrap, Options/Share không tác động, Wait tiếp tục,
  canceled motion ownership, reconnect held/neutral/new action, LED và heartbeat.
- Năm bài round-trip serialization/deserialization, model/board/biến/ID giữ;
  generator deterministic; project macro cũ vẫn mở/sinh code được.
- Chrome headless **157**, Arduino Core **3.3.7**: **7/7 compile PASS**. Ngoài năm
  bài, standalone autonomous motor 344720 byte và legacy events 343440 byte.
  Cả bảy gói qua `validatePackage` với bốn segment
  `0x0/0x8000/0xe000/0x10000`, đúng board/FQBN/hash.
- Đổi source làm build ID đổi; cú pháp C++ sai bị từ chối; manifest URL không
  tồn tại bị báo lỗi. Không xem các check này là flash/hardware acceptance.
- Payload WASM lấy source canonical từ `firmware/libraries` bằng
  `node tools/sync-browser-libraries.mjs`. SHA-256 revision:
  `05859712244b9f29151e001945a32bf7fb8a4958d4020a16f0b0d86be67336ba`.
  Worker kiểm tra payload/manifest cùng revision, dùng revision trong object
  cache key và build identity. Unit test đối chiếu mọi file nguồn đã đóng gói.
- Runner Chrome dùng profile tạm riêng trong build-output; không xóa profile
  ngoài repo hoặc cần `--no-sandbox`. Production feature flag không đổi.

Log/report local (ignored build artifacts):
`firmware/tests/build-output/no-arm-final-tests.log`, `no-arm-wasm.log`,
`blockly-wasm-verification-report.json`.

## Live Chrome UI

Đã quan sát: UI mới của Bách, bảy nhóm toolbox; tạo/đổi tên/chuyển/reload dự án;
Wait sửa 0,5 → 0,6 giữ sau reload; kéo Wait từ toolbox tăng block 1 → 2 và undo
về 1; file input nhập bài 02 thành công với 24 block; zoom/reset, sáng/tối và
Serial Monitor chưa kết nối. Chưa chọn cổng Serial/USB.

Mã nguồn mặc định đóng, không tự mở khi sửa/switch/import/reload; logic học
sinh gắn nhãn không biên dịch được, C++ đầy đủ vẫn có scheduler; copy báo thành
công. Panel giữ kiểu dáng/animation nhưng có diện tích riêng và co giãn. Ở
680×800: documentWidth=680, workspace.bottom=panel.top=546,52 px, không chồng.

Bài 01 compile ngay trong Device modal thành công (14694 ms); USB chỉ enabled
sau compile. Trong lúc compile cả Compile/USB/Đóng bị khóa; Escape không đóng
modal. Sửa Wait rồi mở lại Device: chưa biên dịch, USB disabled. React DOM tests
còn kiểm tra cancellation/error, double-click lock và trạng thái không compiler.
Không có bridge local không còn hiển thị lỗi khi WASM sẵn sàng.

Ảnh local: `firmware/tests/build-output/ui-integration/no-arm-compile-success.png`
và `no-arm-narrow.png`.

**Giới hạn:** event download export của browser tool timeout hai lần; không
ghi export qua browser PASS hoặc hoàn tất vòng export-download-import thực tế.
Import file thật và model round-trip đã PASS. USB connect/upload/readback, LED
vật lý, pairing, tải motor và thời gian dừng vật lý chưa thử. “Dừng” phần mềm
nghĩa là lượt safety/update kế tiếp; không có bảo đảm ngắt cứng độc lập CPU mới.

## Rà soát nhánh UI — chưa xóa

| Nhánh | Kết luận |
| --- | --- |
| `feat/ui_ux` | HEAD được bảo toàn qua ancestry integration. Có thể dọn sau khi chủ dự án xử lý PR #33 đang mở và xác nhận danh sách; chưa xóa. |
| `codex/integrate-bach-ui` | Patch-equivalence còn unmatched `e5df87a`, `1ac87cb`; giữ, chưa coi toàn bộ việc đã được bảo toàn hoặc có archive an toàn. |
| `docs/ui_ux_block` | History riêng còn `54ef650`, `7ebec68`, `fea292e`; template JS được giữ, effects thay đổi có chủ đích trong UI mới; giữ tới khi kiểm toán/backup đầy đủ. |
| local `feat/ux_ui` | Remote đã gone trước tác vụ; không xóa local. |

[PR #33](https://github.com/HiyoriVn/CodeLab/pull/33) vẫn mở khi rà soát lại.
Không nhánh nào được xóa tự động; không xóa `main`, MVP hoặc integration.
Push integration không phải merge main hoặc deploy production.
