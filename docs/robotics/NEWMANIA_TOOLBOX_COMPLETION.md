# Newmania: hoàn thiện 17 mục toolbox — 2026-11-11

Tiếp nối `NEWMANIA_GENERATOR_STAGE3.md`. Mốc giai đoạn 3 giữ 17 mục khóa;
bản bổ sung này triển khai generator và API tương ứng trước khi mở khóa.

## Danh mục

Giữ 8 nhóm, 48 mục block tĩnh (nhóm Biến còn có flyout động): 45 mục sử dụng
được, 3 mục LED tiếp tục khóa theo quyết định của chủ dự án. Không thêm macro
robot, không đổi cấu trúc chương trình hay thanh công cụ.

14 mục được mở: while/until, vòng đếm for, break/continue, chia dư, phép toán
một đầu vào, số nguyên ngẫu nhiên, làm tròn, giới hạn số, ghép chữ, in chữ,
Serial có dữ liệu, Serial in RAW/LN, số byte có sẵn và đọc một byte.

Ba mục Bật LED, Tắt LED và Nhấp nháy LED giữ khóa. Danh mục và chẩn đoán
ghi rõ GPIO47 đang dành cho kết nối/an toàn. Block đã lưu vẫn được giữ;
generator từ chối biên dịch và chỉ rõ block, không âm thầm bỏ qua hoặc đổi GPIO.

Nhãn PS4 được rút gọn thành “Nút …”, “Độ nghiêng cần Trái/Phải theo
Ngang/Dọc” và “Tay cầm PS4 đã kết nối?”, kèm tooltip có ví dụ. Hai dropdown
của cần vẫn chỉ lưu `AXIS` 0–3 như trước; lựa chọn cần được suy ra khi mở
project và undo/redo. Không đổi ID block, generator, API hay ánh xạ trục.

## Hành vi

- Vòng lặp sinh các bước hợp tác, không sinh vòng `while` chặn cập nhật board.
  Share STOP, Options ARM, cập nhật PS4 và watchdog đi qua runtime hiện có.
- For lấy điểm đầu/cuối/bước một lần theo thứ tự trái sang phải; dùng độ lớn
  bước, tự tăng hoặc giảm về điểm cuối, tính cả hai đầu. Continue tăng biến,
  break thoát vòng gần nhất. Bước 0 cố định bị chặn trước compile; bước động
  không hợp lệ bỏ qua vòng và đưa thông báo vào hàng đợi Serial.
- Giữ giới hạn bốn vòng lồng, 1024 bước tĩnh. Biểu thức giới hạn 16 cấp và
  512 khối giá trị. Không thêm biến chuỗi/Boolean hoặc My Blocks.
- Serial đọc không chờ: trả byte 0–255, trả -1 khi rỗng. Các phép toán có đọc
  Serial/ngẫu nhiên bảo toàn thứ tự trái sang phải. AND/OR giữ short-circuit.
- RAW không thêm xuống dòng; LN thêm LF. In dùng hàng đợi hiện có, tối đa
  8 thông điệp, mỗi thông điệp 127 byte, phục vụ tối đa 32 bước ghi mỗi update.
  Ghép chữ là giá trị tạm có bộ đệm cố định; tràn bị từ chối cả thông điệp,
  không in phần bị cắt. Có thể mất thông điệp khi hàng đợi đầy (`messageDrops`).
- Chia dư dùng `fmod`, giữ dấu số bị chia. Số chia 0 cố định bị chặn; số chia
  động 0/không hữu hạn trả 0 và cảnh báo một lần mỗi RUN.
- Ngẫu nhiên là PRNG xorshift32, một bước hữu hạn mỗi lần đọc, phạm vi int32
  bao gồm hai đầu và tự đổi hai cận bị đảo. Seed khởi động cố định; không dùng
  cho mật mã, không cam kết phân phối hoàn toàn đồng đều.

## Phạm vi và nghiệm thu

Không đổi profile, FQBN, GPIO, PWM, hướng motor, D1/I²C, driver, bộ nhận,
scheduler core hoặc watchdog. Project cũ vẫn dùng đường generator cũ; không
tự chuyển dữ liệu. Các test cũ giữ nguyên mục tiêu và thay mẫu “chưa hỗ trợ”
sang LED vì vòng for nay đã được hỗ trợ.

`tests/newmania-extended.test.mjs` kiểm tra 14 mục được mở, ba LED khóa,
chạy C++ sinh ra với runtime thật trên nền tảng giả lập, lặp lồng/break/continue,
watchdog/STOP, thứ tự đọc Serial, RAW/LN, toán học, giới hạn bộ đệm và chẩn đoán
không làm mất dữ liệu. Test dùng Windows executable, không nối hoặc kích motor.

Working tree: `npm test` **112/112 PASS**, `npm run build` **PASS**. Native
Windows executable tests chạy thành công. Đã sửa xung đột tên helper với macro
`constrain` của Arduino và thêm regression test cho trường hợp macro này.

Ba sketch sinh từ các bài kiểm thử vòng lặp, Serial và toán học được biên dịch
bằng Arduino CLI 1.5.1, ESP32 core 3.3.7. Dùng đúng FQBN đã kiểm thử:

```text
esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=disabled,USBMode=hwcdc,CDCOnBoot=cdc
```

Đây là compile-only; các bài native chạy runtime thật với GPIO/I²C/Serial giả.
Không có kết luận mới về hành vi trên phần cứng thật.

Nghiệm thu kéo thả trên ứng dụng tích hợp còn chưa xác nhận: cổng phê duyệt
trình duyệt trước đó từ chối origin localhost. Không dùng origin hoặc công cụ
khác để vượt qua giới hạn này. Không deploy, flash, push hoặc merge.
