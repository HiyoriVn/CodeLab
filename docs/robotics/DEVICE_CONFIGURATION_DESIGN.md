# Device Configuration cho CodeLab

Thiết kế ngày 2026-11-09, lập trước khi sửa generator và firmware tích hợp.

## Tham khảo VEXcode IQ

| Quan sát | Áp dụng vào CodeLab |
| --- | --- |
| Motor được khai báo trong Devices theo cổng, tên và chiều đảo. Toolbox phụ thuộc thiết bị đã cấu hình. | Hộp **Cấu hình robot** quản lý tên, cổng M1–M6, chiều, trạng thái bật/tắt và mức xác minh. Khối lưu ID motor ổn định, đổi tên vẫn giữ tham chiếu. [Smart Motors](https://kb.vex.com/hc/en-us/articles/360035953011-Configuring-Smart-Motors-in-VEXcode-IQ) |
| Controller được cấu hình riêng. Có thể gán nhanh joystick hoặc lập trình bằng khối. | Khai báo nguồn PS4 trong cấu hình. Khối lái nhanh fast100 vẫn có thể dùng, và bài mới có trục/nút để học sinh tự viết điều kiện. [Configuring a Controller](https://kb.vex.com/hc/en-us/articles/4407063155732-Configuring-a-Controller-in-VEXcode-IQ) |
| VEX trình bày ba cách gán sẵn, vòng lặp và các stack sự kiện theo cạnh. | Giữ khối vòng lặp/if-else và thêm sự kiện PS4 nhấn/thả. Chỉ dùng báo cáo mới, lấy mẫu trạng thái hiện tại khi mới kết nối. [Custom Controller Code](https://kb.vex.com/hc/en-us/articles/14216995018132-Custom-Controller-Code-in-VEXcode-IQ) |
| Bài mẫu mở các stack có thể tháo/sửa. Template chứa cấu hình thiết bị khởi đầu. | Lưu cấu hình cùng bài mẫu CodeLab và dùng các stack có thể sửa từng lệnh. [Examples and Templates](https://kb.vex.com/hc/en-us/articles/4403663392788-Using-VEXcode-IQ-Blocks-Example-Projects-and-Templates) |
| Lệnh có chờ trì hoãn khối kế tiếp, lệnh không chờ cho stack chạy tiếp. | Cho chạy motor theo mili giây với lựa chọn có chờ. PWM điều khiển hở, trạng thái là lệnh PWM đã áp dụng. [Waiting and Non-waiting Blocks](https://kb.vex.com/hc/en-us/articles/360035592312-Understanding-Waiting-and-Non-waiting-Blocks-in-VEXcode-IQ) |

## Đối chiếu repo và thiết kế

- Registry đã có kênh vật lý V1 N8R2 M1–M4, V2 M1–M6, profile fast100 riêng và profile OPI giới hạn LED. Hộp Thiết bị hiện dành cho build/nạp. Thêm hộp **Cấu hình robot** độc lập, lưu dữ liệu phiên bản 1 theo board ID trong project. Kiểm tra trùng cổng, motor tắt, tham chiếu thiếu và bốn bánh khác nhau. V1/V2 cho cấu hình theo mapping đã biết, còn phát lệnh motor vật lý tiếp tục bị chặn. Profile OPI không mở kênh motor. Dữ liệu từng profile được giữ khi đổi board.
- Các khối fast100 hiện lấy cấu hình từ stack Khi bắt đầu và hỗ trợ lệnh cả drivetrain. Giữ đường sinh code cũ cho dự án phiên bản 1. Với cấu hình mới, tách danh mục **Motor**, **Drivetrain mecanum**, **Tay cầm PS4**. Motor có quay, dừng, quay theo thời gian và đọc PWM có dấu. Drivetrain có bốn bánh theo thứ tự trước trái/phải, sau trái/phải, giới hạn PWM và ba trục độc lập. Help của mỗi khối mô tả đầu vào, trạng thái và hành vi chờ.
- Runtime Blockly tiếp tục dùng CodeLabFast4wd và backend MCPWM đã tách từ fast100. Tầng yêu cầu từng motor đi qua cùng cổng ARM, freshness, giới hạn PWM và kiểm tra phần cứng. Yêu cầu motor độc lập ghi đè bánh cùng cổng cho tới khi trả quyền cho drivetrain. Lệnh có chờ liên tục phục vụ I2C/watchdog trong khi stack tạm dừng. Những stack Blockly khác được hoãn trong thời gian đó, cạnh đi qua trong lúc chờ không được phát lại. Share hoặc lỗi link xóa mọi lệnh độc lập và bộ hẹn giờ. Options chỉ ARM từ thao tác hợp lệ trên tay cầm. Không thêm chạy theo vị trí, encoder, PID hay giữ vị trí.
- Kiểm tra bằng bài mecanum tự ghép ba trục trong vòng lặp và bài nút PS4 chạy từng motor theo thời gian. Đối chiếu bộ sinh, runtime host, compile Arduino, lưu/mở dự án cũ và kiểm tra profile. Sketch đã chạy trên phần cứng trong thư mục demo fast100 và driver nguồn tại đó được giữ nguyên.
