# CodeLab

**CodeLab** là web lập trình bằng khối lệnh (block) cho robot dùng ESP32-S3. Bạn kéo thả khối để viết chương trình, CodeLab tự sinh mã Arduino C++, biên dịch và nạp thẳng vào mạch qua cổng USB, không cần cài thêm phần mềm nào khác (với bản chạy trên web).

> Tài liệu này hướng dẫn **cách sử dụng web**. Nếu bạn muốn tìm hiểu kiến trúc, phần cứng hay kiểm thử, xem thư mục [`docs/`](docs/).

## Mục lục

1. [Yêu cầu](#1-yêu-cầu)
2. [Mở CodeLab](#2-mở-codelab)
3. [Làm quen với giao diện](#3-làm-quen-với-giao-diện)
4. [Chương trình đầu tiên](#4-chương-trình-đầu-tiên)
5. [Chọn board và bài mẫu](#5-chọn-board-và-bài-mẫu)
6. [Kéo thả khối lệnh](#6-kéo-thả-khối-lệnh)
7. [Xem mã nguồn](#7-xem-mã-nguồn)
8. [Biên dịch và nạp vào mạch](#8-biên-dịch-và-nạp-vào-mạch)
9. [Bảng lệnh (Serial)](#9-bảng-lệnh-serial)
10. [Lưu, mở và quản lý dự án](#10-lưu-mở-và-quản-lý-dự-án)
11. [Tay cầm PS4 / PS2](#11-tay-cầm-ps4--ps2)
12. [Tùy chỉnh giao diện](#12-tùy-chỉnh-giao-diện)
13. [Xử lý sự cố](#13-xử-lý-sự-cố)
14. [Chạy CodeLab trên máy (cho nhà phát triển)](#14-chạy-codelab-trên-máy-cho-nhà-phát-triển)

---

## 1. Yêu cầu

| Thứ cần có | Ghi chú |
| --- | --- |
| Trình duyệt **Chrome** hoặc **Edge** (bản mới) | Nạp mạch và Serial dùng **Web Serial**, Firefox và Safari chưa hỗ trợ |
| Mạch ESP32-S3 (Newmania V1 / V2) | Xem [mục 5](#5-chọn-board-và-bài-mẫu) |
| Cáp USB **có truyền dữ liệu** | Cáp chỉ sạc sẽ không nhận cổng |

## 2. Mở CodeLab

Truy cập địa chỉ web CodeLab do nhóm cung cấp. Dự án được lưu ngay trong trình duyệt bạn đang dùng, không cần đăng nhập.

## 3. Làm quen với giao diện

```
┌──────────────────────────────────────────────────────────────────┐
│ CodeLab  Cài đặt  Tập tin  Hướng dẫn  Changelog  [Tên dự án]     │  ← Thanh menu
│                                      🌙  🎨  Thiết bị  Bảng lệnh  Mã │
├──────────────────────────────────────────────────────────────────┤
│ Chế độ ▾   Board ▾   Bài mẫu ▾            trạng thái chương trình │  ← Thanh công cụ
├────────┬─────────────────────────────────────────┬───────────────┤
│ Toolbox│          Vùng lập trình                 │  Xem mã       │
│ (nhóm  │       (kéo thả khối vào đây)            │  (mở bằng nút │
│  khối) │                                         │   Mã nguồn)   │
├────────┴─────────────────────────────────────────┴───────────────┤
│                    Bảng lệnh / Serial (mở bằng nút Bảng lệnh)     │
└──────────────────────────────────────────────────────────────────┘
```

**Thanh menu phía trên**

| Nút | Chức năng |
| --- | --- |
| **Cài đặt** | Chọn ngôn ngữ giao diện (Tiếng Việt; English sắp có) |
| **Tập tin** | Tạo dự án mới, mở/lưu file từ máy tính, chuyển giữa các dự án trong trình duyệt |
| **Hướng dẫn** | Hướng dẫn nhanh và mô tả các khối cấu hình robot |
| **Changelog** | Lịch sử các phiên bản. Bấm vào từng phiên bản ở cột trái để xem nội dung |
| **Ô tên dự án** | Bấm vào để đổi tên dự án |
| Công tắc sáng/tối | Chuyển giao diện sáng và tối |
| Biểu tượng bảng màu | Đổi màu thanh menu |
| **Thiết bị** | Biên dịch và nạp chương trình vào mạch |
| **Bảng lệnh** | Mở/đóng bảng Serial |
| **Xem mã nguồn** | Mở/đóng bảng mã |

**Thanh công cụ dưới menu**

| Mục | Chức năng |
| --- | --- |
| **Chế độ** | Cơ bản hoặc Nâng cao |
| **Board** | Chọn loại mạch bạn đang dùng |
| **Bài mẫu** | Mở nhanh một bài mẫu có sẵn |

## 4. Chương trình đầu tiên

1. Chọn **Board** đúng với mạch của bạn (ví dụ *Newmania V2 ESP32S3*).
2. Mở **Bài mẫu → Bài 01 — Serial Counter** để xem một chương trình hoàn chỉnh.
3. Bấm **Thiết bị** → **Biên dịch chương trình**.
4. Cắm mạch vào máy bằng cáp USB, bấm **Chọn USB và nạp**, chọn cổng của mạch rồi xác nhận.
5. Bấm **Bảng lệnh** để xem robot gửi dữ liệu về.

## 5. Chọn board và bài mẫu

**Board** (menu **Board** trên thanh công cụ): bấm vào để xem danh sách, có thể tìm bằng bàn phím.

| Board | Ghi chú |
| --- | --- |
| **Newmania V2 ESP32S3** | 6 động cơ (M1–M6), 6 servo (S1–S6), hỗ trợ PS4 (UART hoặc I2C) và PS2 (SPI) |
| **Newmania Starter V1.0** | 4 động cơ, 4 servo, bo dùng để thử nghiệm |

> Mỗi dự án nhớ board của riêng nó. Hãy chọn đúng board **trước khi** biên dịch.

**Bài mẫu** (menu **Bài mẫu**): chọn một bài để mở thành dự án có thể chỉnh sửa.

| Bài | Nội dung |
| --- | --- |
| Bài 01 — Serial Counter | Đếm số và gửi lên Serial |
| Bài 02 — PS4 Connection | Báo trạng thái kết nối tay cầm PS4 |
| Bài 03 — Kiểm tra từng Motor | Điều khiển từng motor bằng nút tay cầm |
| Bài 04 — Di chuyển 4 bánh cơ bản | Tiến, lùi, quay trái/phải bằng nút |
| Bài 05 — Mecanum bằng hai Joystick | Lái robot mecanum bằng hai cần analog |
| Bài 06 — Kiểm tra Servo | Kiểm tra servo (V2: S1–S6, V1: S1–S4) |

## 6. Kéo thả khối lệnh

1. **Chọn nhóm khối** ở cột trái (toolbox). Đưa chuột vào một mục sẽ thấy hiệu ứng đổi màu.
2. **Kéo khối** vào vùng lập trình.
3. **Nối khối**: thả khối gần đáy của khối khác để nối thành chuỗi, chương trình chạy từ trên xuống dưới.
4. **Xóa khối**: kéo khối về lại cột trái, hoặc chọn khối rồi nhấn `Delete`.
5. Điền số, chọn giá trị trong ô dropdown của từng khối để cấu hình (ví dụ chọn motor, chọn nút tay cầm).

Một chương trình luôn bắt đầu từ khối **Bắt đầu chương trình**.

Có thể phóng to/thu nhỏ vùng lập trình bằng bộ nút zoom ở góc vùng lập trình hoặc con lăn chuột kèm `Ctrl`.

**Chế độ**

- **Cơ bản**: bộ khối đơn giản, phù hợp khi mới học.
- **Nâng cao**: thêm các khối điều khiển phần cứng chi tiết hơn.

## 7. Xem mã nguồn

Bấm **Xem mã nguồn** (biểu tượng ở góc phải thanh menu) để mở bảng mã. Bảng này nổi lên trên vùng làm việc và có thể kéo giãn kích thước. Bạn có thể xem:

- **Mã giả / logic**: dễ đọc, hiện giao thức tay cầm đang dùng.
- **Arduino C++ đầy đủ**: mã thật được biên dịch.

Bảng mã chỉ để **xem**. Muốn đổi chương trình, hãy sửa trên các khối.

## 8. Biên dịch và nạp vào mạch

Bấm **Thiết bị** trên thanh menu. Hộp thoại gồm 2 bước:

### Bước 1: Biên dịch chương trình

Bấm **Biên dịch chương trình**. Trạng thái sẽ đi từ *Đang biên dịch* đến *Thành công*. Nếu *Thất bại*, đọc thông báo lỗi và kiểm tra lại các khối.

### Bước 2: Nạp chương trình

1. Cắm mạch bằng cáp USB.
2. Bấm **Chọn USB và nạp** và chọn đúng cổng của mạch trong hộp thoại của trình duyệt.
3. Xác nhận cảnh báo an toàn. **Ngắt nguồn động cơ** và để robot ở trạng thái an toàn (nhấc bánh khỏi mặt đất) trước khi nạp.
4. Chờ thanh tiến trình chạy đến *Hoàn tất*.

> Nạp chương trình sẽ **thay thế** chương trình hiện có trên mạch.

> Khi nạp và khi mở Serial, hai chức năng dùng chung một kết nối USB. CodeLab tự đóng/mở cổng giúp bạn, nhưng không nên mở cùng cổng đó ở phần mềm khác (Arduino IDE, PuTTY…).

## 9. Bảng lệnh (Serial)

Bấm **Bảng lệnh** để mở bảng Serial:

| Nút | Chức năng |
| --- | --- |
| **Kết nối** / **Ngắt kết nối** | Mở hoặc đóng cổng Serial |
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
| **Lưu về máy tính** | Xuất dự án ra file để sao lưu hoặc chia sẻ |
| **Dự án trên trình duyệt này** | Danh sách dự án đã lưu, bấm để chuyển qua lại |

> Dự án tự lưu trong **trình duyệt hiện tại**. Nếu xóa dữ liệu trình duyệt hoặc đổi máy, dự án sẽ mất. Hãy **Lưu về máy tính** để sao lưu.

## 11. Tay cầm PS4 / PS2

- **PS4**: kết nối với mạch qua **UART** hoặc **I2C** (chọn kiểu kết nối phù hợp với mạch của bạn).
- **PS2** (chỉ Newmania V2): kết nối qua **SPI**, có khối riêng cho joystick, nút bấm và trạng thái kết nối.
- Danh mục khối PS4 và PS2 tách riêng. **Không dùng lẫn hai loại tay cầm** trong cùng một chương trình.
- Khi mất kết nối với tay cầm, các motor tự dừng để đảm bảo an toàn. Sau khi kết nối lại, cần đưa cần về vị trí giữa rồi mới điều khiển tiếp.

## 12. Tùy chỉnh giao diện

- **Sáng/Tối**: bấm công tắc hình mặt trời/mặt trăng.
- **Màu thanh menu**: bấm biểu tượng bảng màu, chọn màu có sẵn hoặc màu tùy chọn, hoặc bấm *Về màu mặc định*.
- **Ngôn ngữ**: **Cài đặt → Ngôn ngữ**.

## 13. Xử lý sự cố

| Vấn đề | Cách xử lý |
| --- | --- |
| Không thấy cổng USB khi nạp | Dùng Chrome/Edge, đổi cáp có truyền dữ liệu, thử cổng USB khác |
| Không chọn được cổng, báo bị chiếm | Đóng Arduino IDE hoặc phần mềm Serial khác, rồi bấm **Ngắt kết nối** trong CodeLab và thử lại |
| Biên dịch thất bại | Đọc thông báo lỗi, kiểm tra khối chưa điền giá trị hoặc dùng sai board, tay cầm |
| Chọn sai board | Chọn lại **Board** rồi biên dịch lại trước khi nạp |
| Bảng khối lệnh trống | Chọn lại board hoặc tải lại trang |
| Mất dự án | Dự án lưu theo trình duyệt. Hãy dùng **Tập tin → Lưu về máy tính** để sao lưu |
| Nạp thành công nhưng robot không chạy | Kiểm tra nguồn động cơ, đúng board và tay cầm đã kết nối |

Nếu vẫn lỗi, mở **Changelog** để xem lỗi đã được sửa ở bản mới chưa.

## 14. Chạy CodeLab trên máy (cho nhà phát triển)

```bash
npm install
npm run dev        # chạy web ở chế độ phát triển
npm run bridge     # (tùy chọn) cầu nối biên dịch/nạp qua Arduino CLI
```

Bản build chạy độc lập:

```bash
npm run build
npm run bridge     # rồi mở http://127.0.0.1:8787
```

Bridge cần **Arduino CLI** và core **ESP32**. Biên dịch ngay trong trình duyệt (WASM) bật cục bộ bằng cách thêm `?wasm_compiler=1` vào địa chỉ.

Các lệnh khác:

```bash
npm test                  # chạy kiểm thử
npm run examples:beginner # sinh lại ví dụ cho người mới
```

Công nghệ: React, Vite, Blockly. Tài liệu chi tiết xem trong [`docs/`](docs/) (`DEVELOPMENT.md`, `ARCHITECTURE.md`, `TESTING.md`, `CLOUDFLARE_PAGES.md`).

---

## Đóng góp

Khi thêm khối lệnh mới, xem mẫu trong [`src/blocks/template/`](src/blocks/template/) và [`README`](src/blocks/template/README.md) của thư mục này.
