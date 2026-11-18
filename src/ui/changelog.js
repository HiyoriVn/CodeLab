export const CHANGELOG = [
    {
    version: '1.3.0',
    date: '18/11/2026',
    title: 'Hỗ trợ bo Newmania V2 và tay cầm PS2',
    items: [
      { type: 'new', text: 'Hỗ trợ bo Newmania V2 (ESP32-S3): 6 động cơ, 6 servo và tay cầm PS4 qua UART hoặc I2C.' },
      { type: 'new', text: 'Hỗ trợ tay cầm PS2 (kết nối SPI) trên Newmania V2, có khối riêng cho joystick, nút bấm và trạng thái kết nối.' },
      { type: 'new', text: 'Danh mục khối PS4 và PS2 được tách riêng trên Newmania V2. Không thể dùng lẫn hai loại tay cầm trong cùng một chương trình.' },
      { type: 'new', text: 'Bài 06: Kiểm tra Servo. Bo V2 kiểm tra được S1–S6, bo V1 vẫn giữ S1–S4.' },
      { type: 'improved', text: 'Mã giả hiển thị giao thức tay cầm đang chọn, các lệnh đọc PS2 có nhãn riêng dễ phân biệt.' },
      { type: 'improved', text: 'Nhãn nút kết nối tay cầm PS4 và chú thích ví dụ rõ ràng hơn, không còn nhầm với PS2.' },
      { type: 'improved', text: 'PS4 UART và servo hoạt động ổn định hơn, biên dịch nhanh hơn nhờ bộ nhớ đệm build, các chức năng dùng chung kết nối USB.' },
      { type: 'fixed', text: 'Sửa lỗi cổng Web Serial khi mở/đóng kết nối giữa nạp firmware và Serial Monitor.' },
      { type: 'fixed', text: 'Sửa lỗi bảng khối lệnh bị trống sau khi đổi bo Newmania.' },
      { type: 'fixed', text: 'Sửa lỗi hiển thị phần mũ của khối "Bắt đầu chương trình".' },
      { type: 'fixed', text: 'Sửa nền phía sau khung lập trình.' },
    ],
  },
  {
    version: '1.2.0',
    date: '17/11/2026',
    title: 'Hỗ trợ servo và tùy biến kết nối module PS4',
    items: [
      { type: 'new', text: 'Hỗ trợ servo: điều khiển servo trực tiếp bằng khối lệnh.' },
      { type: 'new', text: 'Tùy biến kết nối module PS4 bằng UART hoặc I2C, chọn kiểu kết nối phù hợp với mạch của bạn.' },
    ],
  },
  {
    version: '1.1.0',
    date: '12/11/2026',
    title: 'Giao diện mới và nạp firmware ngay trên trình duyệt',
    items: [
      { type: 'new', text: 'Chương trình Newmania dùng một luồng duy nhất, có bài mẫu robot mecanum 4 bánh bằng PS4.' },
      { type: 'new', text: 'Nạp firmware trực tiếp từ trình duyệt, không bắt buộc phải cài bridge cục bộ.' },
      { type: 'improved', text: 'Menu chọn Board và Bài mẫu mới, có hiệu ứng mở/đóng và tìm bằng bàn phím.' },
      { type: 'improved', text: 'Hộp thoại đóng mượt hơn khi nhấn Esc hoặc bấm ra ngoài.' },
      { type: 'improved', text: 'Nhãn khối tay cầm PS4 dễ hiểu hơn, dữ liệu dự án cũ được giữ nguyên.' },
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;

const SEEN_KEY = 'codelab.changelog.seen.v1';

export const TYPE_LABEL = {
  new: { text: 'Mới', tone: 'ok' },
  improved: { text: 'Cải thiện', tone: 'info' },
  fixed: { text: 'Sửa lỗi', tone: 'warn' },
};

export function readSeenVersion() {
  try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
}
export function saveSeenVersion(version = LATEST_VERSION) {
  try { localStorage.setItem(SEEN_KEY, version); } catch { /* storage unavailable */ }
}

export const hasUnseenChangelog = () => readSeenVersion() !== LATEST_VERSION;
