export const CHANGELOG = [
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
