# CodeLab

**CodeLab** là web lập trình bằng khối lệnh (block) cho robot dùng ESP32-S3. Bạn kéo thả khối để viết chương trình, CodeLab tự sinh mã Arduino C++, biên dịch và nạp thẳng vào mạch qua cổng USB, không cần cài thêm phần mềm nào khác.

> Tài liệu này hướng dẫn **cách sử dụng web CodeLab**.

## Mục lục

1. [Yêu cầu](#1-yêu-cầu)
2. [Mở CodeLab](#2-mở-codelab)
3. [Làm quen với giao diện](#3-làm-quen-với-giao-diện)
4. [Chương trình đầu tiên](#4-chương-trình-đầu-tiên)
5. [Chọn board và chương trình mẫu](#5-chọn-board-và-chương-trình-mẫu)
6. [Kéo thả khối lệnh](#6-kéo-thả-khối-lệnh)
7. [Xem mã nguồn](#7-xem-mã-nguồn)
8. [Biên dịch và nạp vào mạch](#8-biên-dịch-và-nạp-vào-mạch)
9. [Bảng lệnh (Serial)](#9-bảng-lệnh-serial)
10. [Lưu, mở và quản lý dự án](#10-lưu-mở-và-quản-lý-dự-án)
11. [Tay cầm PS4 / PS2](#11-tay-cầm-ps4--ps2)
12. [Tùy chỉnh giao diện](#12-tùy-chỉnh-giao-diện)
13. [Xử lý sự cố](#13-xử-lý-sự-cố)

---

## 1. Yêu cầu

| Thứ cần có | Ghi chú |
| --- | --- |
| Trình duyệt **Chrome** hoặc **Edge** (bản mới) | Nạp mạch và Serial dùng **Web Serial**, Firefox và Safari chưa hỗ trợ |
| Mạch ESP32-S3 (Newmania V2 hoặc Newmania ESP32S3 Board) | Xem [mục 5](#5-chọn-board-và-chương-trình-mẫu) |
| Cáp USB **có truyền dữ liệu** | Cáp chỉ sạc sẽ không nhận cổng |

## 2. Mở CodeLab

Truy cập địa chỉ web CodeLab do nhóm cung cấp. Dự án được lưu ngay trong trình duyệt bạn đang dùng, không cần đăng nhập.

Bấm **Changelog** trên thanh menu để xem những gì mới ở từng phiên bản.

## 3. Làm quen với giao diện

```
┌──────────────────────────────────────────────────────────────────┐
│ CodeLab  Cài đặt  Tập tin  Hướng dẫn  Changelog  [Tên dự án]     │
│        Sáng/Tối  Màu  Thiết bị  Bảng lệnh  Xem mã nguồn          │
├──────────────────────────────────────────────────────────────────┤
│ Board ▾   Chương trình mẫu ▾                                     │
├────────┬─────────────────────────────────────────┬───────────────┤
│ Toolbox│     Vùng lập trình                      │ Mã nguồn      │
│ (nhóm  │  (kéo thả khối vào đây)                 │ (mở bằng nút  │
│  khối) │                                         │ Xem mã nguồn) │
├────────┴─────────────────────────────────────────┴───────────────┤
│        Bảng lệnh / Serial (mở bằng nút Bảng lệnh)                │
└──────────────────────────────────────────────────────────────────┘
```

**Thanh menu phía trên**

| Nút | Chức năng |
| --- | --- |
| **Cài đặt** | Chọn ngôn ngữ giao diện (hiện chỉ có Tiếng Việt, English sắp có) |
| **Tập tin** | Tạo dự án mới, mở/lưu file từ máy tính, chuyển giữa các dự án trong trình duyệt |
| **Hướng dẫn** | Hướng dẫn nhanh và mô tả các khối cấu hình robot |
| **Changelog** | Lịch sử các phiên bản, bấm vào từng phiên bản để xem nội dung |
| **Ô tên dự án** | Bấm vào để đổi tên dự án |
| Công tắc sáng/tối | Chuyển giao diện sáng và tối |
| Biểu tượng bảng màu | Đổi màu thanh menu |
| **Thiết bị** | Biên dịch và nạp chương trình vào mạch |
| **Bảng lệnh** | Mở/đóng bảng Serial |
| **Xem mã nguồn** | Mở/đóng bảng mã |

**Thanh công cụ dưới menu**

| Mục | Chức năng |
| --- | --- |
| **Board** | Chọn loại mạch bạn đang dùng |
| **Chương trình mẫu** | Mở nhanh một chương trình mẫu có sẵn |

Dưới vùng lập trình có dòng trạng thái cho biết số khối đang dùng, và góc vùng lập trình có bộ nút phóng to, thu nhỏ, về kích thước mặc định.

## 4. Chương trình đầu tiên

1. Chọn **Board** đúng với mạch của bạn (ví dụ *Newmania V2 ESP32S3*).
2. Mở **Chương trình mẫu → Bài 01 — Serial Counter** để xem một chương trình hoàn chỉnh.
3. Bấm **Thiết bị** → **Biên dịch chương trình**.
4. Cắm mạch vào máy bằng cáp USB, bấm **Chọn USB và nạp**, chọn cổng của mạch rồi xác nhận.
5. Bấm **Bảng lệnh** → **Chọn cổng & kết nối** để xem robot gửi dữ liệu về.

## 5. Chọn board và chương trình mẫu

**Board** (menu **Board** trên thanh công cụ): bấm vào để xem danh sách, có thể tìm bằng bàn phím.

| Board | Ghi chú |
| --- | --- |
| **Newmania V2 ESP32S3** | 6 động cơ (M1–M6), 6 servo (S1–S6), hỗ trợ tay cầm PS4 (UART hoặc I2C) và PS2 (SPI) |
| **Newmania ESP32S3 Board** | 4 động cơ (M1–M4), 4 servo (S1–S4), hỗ trợ tay cầm PS4 |

> Mỗi dự án nhớ board của riêng nó. Hãy chọn đúng board **trước khi** biên dịch.

**Chương trình mẫu** (menu **Chương trình mẫu**): chọn một bài để mở thành **dự án mới** có thể chỉnh sửa. Các dự án khác của bạn vẫn được giữ nguyên.

| Bài | Nội dung |
| --- | --- |
| Bài 01 — Serial Counter | Đếm số và gửi lên Serial |
| Bài 02 — PS4 Connection | Báo trạng thái kết nối tay cầm PS4 |
| Bài 03 — Kiểm tra từng Motor | Giữ nút mũi tên để chạy từng motor, nhấn L1 để đảo chiều |
| Bài 04 — Di chuyển 4 bánh cơ bản | Tiến, lùi, quay trái/phải bằng các nút mũi tên |
| Bài 05 — Mecanum bằng hai Joystick | Lái robot mecanum bằng hai cần analog |
| Bài 06 — Kiểm tra Servo | Lần lượt quay thử từng servo (V2: S1–S6, V1: S1–S4) |

## 6. Kéo thả khối lệnh

1. **Chọn nhóm khối** ở cột trái (toolbox): *Bắt đầu & Điều khiển*, *Logic*, *Toán học*, *Biến*, *Hiển thị / Serial*, *Motor*, *Servo*, *Tay cầm PS4* (và *Tay cầm PS2* trên Newmania V2).
2. **Kéo khối** vào vùng lập trình.
3. **Nối khối**: thả khối gần đáy của khối khác để nối thành chuỗi, chương trình chạy từ trên xuống dưới.
4. **Xóa khối**: kéo khối về lại cột trái, hoặc chọn khối rồi nhấn `Delete`.
5. Điền số, chọn giá trị trong ô dropdown của từng khối để cấu hình (ví dụ chọn motor, chọn nút tay cầm).

**Cấu trúc một chương trình**

- Chương trình luôn nằm trong khối **Khi bắt đầu chương trình**. Khối này chạy một lần sau khi mạch khởi động và là khối gốc duy nhất.
- Khối **Lặp mãi mãi** đặt ở **cuối** chương trình, ngay trong khối gốc. Chỉ dùng một khối này.
- Nếu dùng tay cầm, đặt khối **Kết nối tay cầm** trước **Lặp mãi mãi** và chỉ dùng một khối.

Khối nào đặt sai chỗ sẽ được báo lỗi, hãy sửa trước khi biên dịch.

Có thể phóng to/thu nhỏ vùng lập trình bằng bộ nút zoom ở góc vùng lập trình hoặc con lăn chuột kèm `Ctrl`.

**Mẹo:** rê chuột lên một khối để đọc mô tả và ví dụ của khối đó. Menu **Hướng dẫn → Help các khối cấu hình robot** liệt kê mô tả các khối điều khiển robot.

## 7. Xem mã nguồn

Bấm **Xem mã nguồn** (biểu tượng ở góc phải thanh menu) để mở bảng mã. Bảng này nằm ở bên phải vùng lập trình và có thể kéo giãn kích thước. Chọn cách xem trong ô chọn ở đầu bảng:

- **Logic chương trình**: mã giả dễ đọc, hiện cả giao thức tay cầm đang dùng.
- **Arduino C++ đầy đủ**: mã thật được biên dịch.

Bấm **Sao chép mã** để chép nội dung đang hiển thị. Bảng mã chỉ để **xem**, muốn đổi chương trình hãy sửa trên các khối.

Nếu chương trình còn khối chưa hoàn chỉnh, bảng mã sẽ báo "Mã chưa hoàn chỉnh" và chưa thể biên dịch.

## 8. Biên dịch và nạp vào mạch

Bấm **Thiết bị** trên thanh menu. Hộp thoại gồm 2 bước:

### Bước 1: Biên dịch chương trình

Bấm **Biên dịch chương trình**. Việc biên dịch chạy ngay trong trình duyệt, trạng thái sẽ đi từ *Đang biên dịch* đến *Thành công*. Lần đầu có thể lâu hơn các lần sau.

Nếu *Thất bại*, kiểm tra lại các khối (khối chưa điền giá trị, dùng sai board hoặc sai loại tay cầm). Nếu bạn sửa chương trình sau khi biên dịch, trạng thái sẽ về *Chưa biên dịch* và cần biên dịch lại trước khi nạp.

### Bước 2: Nạp chương trình

1. Cắm mạch bằng cáp USB.
2. Bấm **Chọn USB và nạp** và chọn đúng cổng của mạch trong hộp thoại của trình duyệt. Từ lần sau nút sẽ hiện tên cổng đã chọn, bấm **Đổi USB** nếu muốn chọn cổng khác.
3. Xác nhận cảnh báo an toàn. **Ngắt nguồn động cơ** và để robot ở trạng thái an toàn (nhấc bánh khỏi mặt đất) trước khi nạp.
4. Chờ thanh tiến trình chạy đến *Hoàn tất*.

> Nạp chương trình sẽ **thay thế** chương trình hiện có trên mạch.

> **Mạch Newmania V2 mới, hoặc từng nạp bằng công cụ khác (như Arduino IDE):** lần nạp đầu CodeLab có thể hỏi khởi tạo lại mạch. Thao tác này **xóa toàn bộ Flash 8MB** của mạch rồi nạp lại cho CodeLab. Chỉ đồng ý nếu bạn không cần giữ chương trình đang có trên mạch.

> Khi nạp và khi mở Serial, hai chức năng dùng chung một kết nối USB. CodeLab tự đóng/mở cổng giúp bạn, nhưng không nên mở cùng cổng đó ở phần mềm khác (Arduino IDE, PuTTY…).

## 9. Bảng lệnh (Serial)

Bấm **Bảng lệnh** để mở bảng Serial. Kéo thanh ngang ở mép trên của bảng để đổi chiều cao.

| Mục | Chức năng |
| --- | --- |
| **Tốc độ truyền** | Chọn 9600, 57600, 115200 (mặc định) hoặc 230400. Chỉ đổi được khi chưa kết nối |
| **Chọn cổng & kết nối** / **Kết nối** | Mở cổng Serial |
| **Ngắt kết nối** | Đóng cổng Serial |
| **Đổi cổng** | Chọn lại cổng USB khác |
| **Xóa log** | Xóa nội dung đang hiển thị |
| Ô lệnh + **Gửi** | Gửi chuỗi ký tự xuống mạch |

Dữ liệu từ khối **Gửi tin nhắn** (ví dụ ở Bài 01) sẽ hiện ở đây.

## 10. Lưu, mở và quản lý dự án

Mở menu **Tập tin**:

| Mục | Chức năng |
| --- | --- |
| **Mới** | Tạo dự án trống |
| **Mở từ máy tính** | Nhập một file dự án (`.codelab.json`) |
| **Lưu về máy tính** | Xuất dự án ra file `.codelab.json` để sao lưu hoặc chia sẻ |
| **Dự án trên trình duyệt này** | Danh sách dự án đã lưu, bấm để chuyển qua lại |

> Dự án tự lưu trong **trình duyệt hiện tại**. Nếu xóa dữ liệu trình duyệt hoặc đổi máy, dự án sẽ mất. Hãy **Lưu về máy tính** để sao lưu.

## 11. Tay cầm PS4 / PS2

- **PS4**: dùng khối **Kết nối tay cầm qua …** rồi chọn **PS4 UART** hoặc **PS4 I²C** cho phù hợp với cách bạn nối mạch.
- **PS2** (chỉ Newmania V2): kết nối qua **SPI**, có nhóm khối **Tay cầm PS2** riêng gồm kết nối, nút bấm, cần joystick và trạng thái kết nối.
- Với mỗi nút, chọn trạng thái **Vừa nhấn** (một lần khi bấm), **Đang giữ** (liên tục khi còn giữ) hoặc **Vừa thả**.
- Khối PS4 và PS2 tách riêng. **Không dùng lẫn hai loại tay cầm** trong cùng một chương trình.
- Khi mất kết nối với tay cầm, các motor tự dừng để đảm bảo an toàn. Sau khi kết nối lại, cần đưa cần về vị trí giữa rồi mới điều khiển tiếp.

## 12. Tùy chỉnh giao diện

- **Sáng/Tối**: bấm công tắc hình mặt trời/mặt trăng.
- **Màu thanh menu**: bấm biểu tượng bảng màu, chọn màu có sẵn hoặc màu tùy chọn, hoặc bấm *Về màu mặc định*.
- **Ngôn ngữ**: **Cài đặt → Ngôn ngữ**. Hiện chỉ có Tiếng Việt.

## 13. Xử lý sự cố

| Vấn đề | Cách xử lý |
| --- | --- |
| Không thấy cổng USB khi nạp | Dùng Chrome/Edge, đổi cáp có truyền dữ liệu, thử cổng USB khác |
| Không chọn được cổng, báo bị chiếm | Đóng Arduino IDE hoặc phần mềm Serial khác, bấm **Ngắt kết nối** trong CodeLab rồi thử lại |
| Nút nạp bị mờ | Biên dịch thành công trước, và dùng Chrome/Edge. Nếu vừa sửa chương trình thì cần biên dịch lại |
| Biên dịch thất bại | Kiểm tra khối chưa điền giá trị, khối đặt sai chỗ, dùng sai board, hoặc trộn khối PS4 với PS2 |
| Chọn sai board | Chọn lại **Board** rồi biên dịch lại trước khi nạp |
| Bảng khối lệnh trống | Chọn lại board hoặc tải lại trang |
| Mất dự án | Dự án lưu theo trình duyệt. Hãy dùng **Tập tin → Lưu về máy tính** để sao lưu |
| Nạp thành công nhưng robot không chạy | Kiểm tra nguồn động cơ, đúng board và tay cầm đã kết nối |

Nếu vẫn lỗi, mở **Changelog** để xem lỗi đã được sửa ở bản mới chưa.
