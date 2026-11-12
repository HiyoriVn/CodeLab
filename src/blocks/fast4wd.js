import * as Blockly from 'blockly';

const colour = '#bd4d86';
const statement = (type, message0, tooltip, args0) => ({
  type, message0, ...(args0 && { args0 }), previousStatement: null, nextStatement: null, colour, tooltip,
});
const direction = (positive, negative) => ({
  type: 'field_dropdown', name: 'DIRECTION', options: [[positive, 'POSITIVE'], [negative, 'NEGATIVE']],
});

const definitions = [
  statement('fast4wd_init', 'khởi tạo robot 4 bánh', 'Đặt trong Khi bắt đầu. Robot chờ nút Options trước khi chạy.'),
  statement('fast4wd_connect', 'kết nối PS4 qua I2C', 'Đặt trong Khi bắt đầu. Cầu ESP32 D1 gửi báo cáo PS4 tới robot qua I2C địa chỉ 0x30.'),
  statement('fast4wd_speed', 'đặt tốc độ tối đa %1 %%', 'Đặt trong Khi bắt đầu. Giới hạn PWM từ 1 đến 100%.',
    [{ type: 'field_number', name: 'PERCENT', value: 100, min: 1, max: 100, precision: 1 }]),
  statement('fast4wd_led', 'bật đèn báo mất kết nối', 'Đặt trong Khi bắt đầu. Đèn sáng khi có kết nối và nháy khi mất báo cáo PS4.'),
  statement('fast4wd_drive', 'điều khiển robot bằng PS4', 'Bấm Options khi cần điều khiển đang ở giữa. Bấm Share để dừng.'),
  statement('fast4wd_forward', 'di chuyển %1', 'Chạy theo hướng chọn khi robot đã ARM và còn nhận báo cáo PS4.', [direction('tiến', 'lùi')]),
  statement('fast4wd_strafe', 'di chuyển ngang sang %1', 'Đi ngang khi robot đã ARM và còn nhận báo cáo PS4.', [direction('trái', 'phải')]),
  statement('fast4wd_turn', 'xoay %1', 'Xoay tại chỗ khi robot đã ARM và còn nhận báo cáo PS4.', [direction('trái', 'phải')]),
  statement('fast4wd_stop', 'dừng robot', 'Dừng và DISARM. Cần bấm Options để ARM lại.'),
  { type: 'fast4wd_connected', message0: 'Tay cầm PS4 đã kết nối?', output: 'Boolean', colour,
    tooltip: 'Đúng khi robot còn nhận dữ liệu mới từ tay cầm. Ví dụ: Nếu Tay cầm PS4 đã kết nối? thì hiển thị “Sẵn sàng”. Sai khi mất kết nối.' },
];

Blockly.defineBlocksWithJsonArray(definitions);

export const fast4wdToolbox = {
  kind: 'category', name: 'Robot PS4', colour,
  contents: definitions.map(({ type }) => ({ kind: 'block', type })),
};
