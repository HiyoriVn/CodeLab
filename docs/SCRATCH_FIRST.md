# Blockly cơ bản — Issue #22

Chọn **Chế độ → Cơ bản**. Dự án mới mặc định Cơ bản; dự án cũ thiếu `project.editorMode` vẫn mở Nâng cao. Chế độ được lưu trong metadata tùy chọn của file version 1 và localStorage. Đổi chế độ chỉ cập nhật toolbox; không xóa block, đổi board hoặc sửa GPIO/kênh đã lưu. Nâng cao giữ các block cũ, biến và hàm (block chưa có generator vẫn báo lỗi).

**Bài mẫu** trên thanh công cụ mở một project mới, giữ bài đang làm. Cũng có thể dùng Tập tin → Mở từ máy tính với ba file `.codelab.json` trong `examples/beginner/`. Cả ba chọn profile Newmania 16MB/OPI8MB đã có; chọn bài là thao tác tường minh chọn profile của bài, không phải remap workspace hiện tại. Không tự biên dịch hoặc nạp.

## Các khối

15 ID mới, không đổi ID/schema khối cũ:

- `beginner_start`: chạy một lần trong setup, sau startup/pin/Serial configuration.
- `beginner_forever`: chạy thân khối trong Arduino loop, nhường CPU bằng `delay(1)`. Nhiều khối chạy lần lượt, không phải tác vụ song song; đợi vẫn là thao tác blocking.
- `beginner_wait`: 1 giây mặc định, giới hạn 0–60 giây.
- `beginner_led`, `beginner_blink`: bật/tắt và nhấp nháy LED từ profile; không đoán GPIO khi board chưa định nghĩa LED.
- `beginner_message`, `beginner_serial_ready`: hiện chữ/số và đọc trạng thái có dữ liệu Serial chờ; xem Bảng lệnh ở 115200. Chưa thay thế các cảm biến vật lý.
- `beginner_ps4_setup`: UART1/115200 từ profile đã định nghĩa; không tự chọn chân cho Generic/experimental.
- `beginner_ps4_sim`, `beginner_ps4_connected`, `beginner_ps4_button`, `beginner_ps4_axis`: mô phỏng tường minh hoặc đọc adapter UART CSV v1 hiện có. Mô phỏng chỉ chỉnh LX và nút X; LY/các nút khác trung tính, không Bluetooth hay actuator. Không dùng hai nguồn cùng lúc. Không thay đổi firmware hoặc giao thức I2C Issue20; bộ cấu hình I2C legacy vẫn chỉ ở Generic/Nâng cao.
- `beginner_motor`, `beginner_motor_stop`, `beginner_servo`: yêu cầu theo kênh, hiện chỉ khi profile có kênh. Chưa có backend được nghiệm thu: báo dễ hiểu và **chặn compile**, không sinh lệnh tải giả. Dropdown giữ kênh cũ và ghi rõ kênh không có trên board; không remap.

Toolbox chia theo màu: Bắt đầu & Điều khiển, Chuyển động, Cảm biến, Tay cầm PS4, Hiển thị, Toán học & Logic, Nâng cao. Nhóm Chuyển động/LED/cấu hình PS4 chỉ hiện khi profile có mapping tương ứng; Nâng cao chỉ hiện trong chế độ Nâng cao. Các khối if/lặp/toán/logic có sẵn được tái sử dụng. Raw GPIO/ADC/PWM/bus không xuất hiện trong Cơ bản.

## Bài mẫu

| Bài | Hành vi Arduino C++ | Tải thật |
|---|---|---|
| `lesson_blink` | LED47 HIGH/LOW mỗi 500ms | Chỉ LED trên mạch |
| `lesson_message` | Lời chào một lần, trạng thái Serial chờ mỗi giây | Không |
| `lesson_ps4_simulation` | In kết nối giả lập/LX=500/nút X=1 mỗi giây | Không |

Generator, board config, device transport và UI tiếp tục tách riêng. Sửa lỗi nameDB của generator được kiểm thử với biến nhận giá trị PS4 mới và tên trùng helper; golden sketches cũ giữ nguyên.

## Kiểm chứng

`npm run examples:beginner` tái tạo fixtures; `node --test tests/beginner.test.mjs` kiểm tra riêng. `npm test` chạy toàn bộ regression; `npm run build` tạo web build. `node tools/verify-beginner-build.mjs` compile riêng ba bài qua HTTP bridge và Arduino CLI hiện có, không dò cổng/nạp. Cần môi trường CLI/data/downloads như `docs/DEVELOPMENT.md`.

Raw compile log: `docs/verification/beginner_compile.log` (ignored). Ảnh smoke test: `docs/verification/SCRATCH_FIRST_UI.png`. Kết quả cuối ghi tại `docs/PROGRESS.md`. Không flash, không thử phần cứng, không sửa board profiles/PS4 firmware/I2C protocol/motor drivers trong sprint này.
