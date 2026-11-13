import * as Blockly from 'blockly';
import './ps4-axis-fields.js';
import { motorIds } from '../boards/robot-devices.js';

const colours = { motor: '#3c82bc', servo: '#1fa288', drive: '#488459', ps4: '#bd4d86' };
const field = (name, options) => ({ type: 'field_dropdown', name, options });
const motor = field('MOTOR', motorIds.map((id, i) => ['Motor ' + (i + 1), id]));
const servos = field('SERVO', [
  ['S1', '1'], ['S2', '2'], ['S3', '3'], ['S4', '4'],
]);
const number = name => ({ type: 'input_value', name, check: 'Number' });
const direction = field('DIRECTION', [['thuận', 'FORWARD'], ['ngược', 'REVERSE']]);
const driveDirection = field('DIRECTION', [
  ['tiến', 'FORWARD'], ['lùi', 'BACKWARD'],
  ['ngang trái', 'STRAFE_LEFT'], ['ngang phải', 'STRAFE_RIGHT'],
  ['xoay trái', 'TURN_LEFT'], ['xoay phải', 'TURN_RIGHT'],
]);
const buttons = field('BUTTON', [
  ['X', '0'], ['Tròn', '1'], ['Vuông', '2'], ['Tam giác', '3'], ['L1', '4'], ['R1', '5'],
  ['L2', '6'], ['R2', '7'], ['L3', '10'], ['R3', '11'], ['Lên', '13'], ['Xuống', '14'], ['Trái', '15'], ['Phải', '16'],
]);
const axes = [
  { type: 'field_ps4_stick', name: 'STICK' },
  { type: 'field_ps4_axis_direction', name: 'AXIS' },
];
const block = (group, type, title, message0, tooltip, args0, shape = 'statement') => ({
  group, title, type: 'robot_' + type, message0, tooltip, args0, colour: colours[group],
  ...(shape === 'statement' ? { previousStatement: null, nextStatement: null } :
    shape === 'event' ? {} : { output: shape }),
});

export const robotBlocks = [
  block('motor', 'motor_spin', 'Quay motor', 'quay %1 chiều %2 PWM %3 %%',
    'Gửi PWM 0–100% cho motor đã chọn và chạy tiếp ngay. Lệnh giữ đến khi dừng, mất kết nối PS4 (nếu chương trình dùng PS4) hoặc trả motor về drivetrain.', [motor, direction, number('POWER')]),
  block('motor', 'motor_power', 'Công suất motor', 'motor %1 công suất %2 %%',
    'Đặt công suất từ −100 đến 100% cho motor đã chọn (dương = thuận, âm = ngược) và giữ lệnh.', [motor, number('POWER')]),
  block('motor', 'motor_for', 'Quay motor theo thời gian', 'quay %1 chiều %2 PWM %3 %% trong %4 ms %5',
    'Hẹn dừng sau 1–5000 ms. Có chờ tạm dừng chương trình khối nhưng vẫn kiểm tra PS4 và watchdog. Không chờ chạy ngay khối kế tiếp.', [
      motor, direction, number('POWER'), { type: 'field_number', name: 'MS', value: 300, min: 1, max: 5000, precision: 1 },
      field('WAIT', [['không chờ', 'NO'], ['có chờ', 'YES']]),
    ]),
  block('motor', 'motor_stop', 'Dừng motor', 'dừng %1',
    'Đưa PWM của riêng motor về 0 trong lượt này. Motor vẫn được tách khỏi drivetrain cho tới khi trả quyền.', [motor]),
  block('motor', 'motor_stop_all', 'Dừng tất cả motor', 'dừng tất cả motor',
    'Đưa PWM của tất cả motor và drivetrain về 0 và tiếp tục chương trình.', []),
  block('motor', 'motor_release', 'Trả quyền điều khiển motor', 'trả %1 về drivetrain',
    'Hủy lệnh độc lập của motor. Nếu có lệnh drivetrain, bánh này nhận lại điều khiển từ drivetrain.', [motor]),
  block('motor', 'motor_pwm', 'Đọc PWM motor', 'PWM đã áp dụng của %1 (%%)',
    'Đọc lệnh PWM phần mềm từ −100 đến 100, theo chiều đã cấu hình. Giá trị không đo tốc độ hay chuyển động thực.', [motor], 'Number'),
  block('servo', 'servo_write', 'Quay servo', 'Servo %1 quay đến %2 độ',
    'Điều khiển góc quay servo từ 0–180 độ. Chỉ phát xung PWM 50 Hz khi khối được gọi; tự động ngắt xung khi dừng hoặc mất kết nối.',
    [servos, number('ANGLE')]),
  block('servo', 'servo_disable', 'Ngắt tín hiệu servo', 'Ngắt tín hiệu Servo %1',
    'Dừng phát xung điều khiển trên chân servo đã chọn (không ngắt nguồn điện cấp cho servo).',
    [servos]),
  block('drive', 'drive_direction', 'Di chuyển theo hướng', 'robot %1 tốc độ %2 %%',
    'Di chuyển robot theo hướng chọn với tốc độ 0–100% và giữ lệnh cho tới khi đổi hướng hoặc dừng.', [driveDirection, number('SPEED')]),
  block('drive', 'mecanum', 'Lái mecanum theo ba trục', 'mecanum tiến %1 ngang trái %2 xoay trái %3 (%%)',
    'Dùng bốn bánh đã gán trong cấu hình. Mỗi trục từ −100 đến 100. Lệnh áp dụng cho lượt lặp hiện tại và không chờ.',
    [number('FORWARD'), number('LEFT'), number('TURN')]),
  block('drive', 'drive_stop', 'Dừng di chuyển robot', 'dừng di chuyển robot',
    'Đưa tốc độ di chuyển drivetrain về 0 và tiếp tục chương trình.', []),
  block('drive', 'drive_for_time', 'Di chuyển theo thời gian', 'robot %1 tốc độ %2 %% trong %3 giây %4',
    'Di chuyển theo hướng chọn trong thời gian 0–60 giây rồi tự dừng drivetrain. Có thể chọn đợi hoặc không đợi.',
    [driveDirection, number('SPEED'), { type: 'field_number', name: 'SECONDS', value: 1, min: 0, max: 60 },
      field('WAIT', [['và đợi', 'YES'], ['không chờ', 'NO']])]),
  block('ps4', 'ps4_axis', 'Độ nghiêng cần', 'Độ nghiêng cần %1 theo %2',
    'Giá trị từ -100 đến 100; cần ở giữa là 0. Ví dụ: chọn Trái và Dọc để đọc độ nghiêng lên/xuống của cần trái. Ngang đọc trái/phải. Trả 0 khi mất kết nối.', axes, 'Number'),
  block('ps4', 'ps4_button', 'Đọc nút PS4', 'nút PS4 %1 đang nhấn?',
    'Đúng khi nút đang được nhấn trong báo cáo PS4 còn mới.', [buttons], 'Boolean'),
  block('ps4', 'ps4_event', 'Khi nhấn hoặc thả nút PS4', 'khi PS4 %1 nút %2 %3',
    'Đặt stack ở ngoài cùng. Chạy một lần theo cạnh của nút, bỏ qua nút đang giữ khi mới kết nối.',
    [field('EDGE', [['nhấn', 'PRESS'], ['thả', 'RELEASE']]), buttons, { type: 'input_statement', name: 'DO' }], 'event'),
];

Blockly.defineBlocksWithJsonArray(robotBlocks.map(({ group, title, ...definition }) => definition));

export function refreshRobotMotorLabels(workspace) {
  for (const block of workspace.getAllBlocks(false)) {
    const selector = block.getField('MOTOR');
    if (!block.type.startsWith('robot_motor_') || !selector) continue;
    selector.forceRerender();
  }
}

for (const { type, args0 } of robotBlocks.filter(item => item.group === 'motor' && item.args0?.[0]?.name === 'MOTOR')) {
  const original = Blockly.Blocks[type].init;
  Blockly.Blocks[type].init = function () {
    original.call(this);
    const selector = this.getField('MOTOR');
    const label = id => {
      const device = this.workspace.codelabRobotDevices?.motors.find(item => item.id === id);
      return device ? device.name + ' · M' + device.port + (device.enabled ? '' : ' (tắt)') :
        'Motor ' + (id?.slice(-1) ?? '') + ' (chưa cấu hình)';
    };
    selector.setOptions(() => args0[0].options.map(([, id]) => [label(id), id]));
    selector.getText_ = () => label(selector.getValue());
  };
}

export function robotDeviceToolbox(devices, profile) {
  if (!devices?.motors.length) return [];
  const makeEntry = (type, args0, extraFields = {}) => ({
    kind: 'block', type,
    ...(Object.keys(extraFields).length && { fields: extraFields }),
    inputs: Object.fromEntries((args0 || []).filter(arg => arg.type === 'input_value').map(({ name: input }) => [
      input, { shadow: { type: 'math_number', fields: { NUM: input === 'POWER' ? 20 : input === 'SPEED' ? 50 : input === 'ANGLE' ? 90 : 0 } } },
    ])),
  });
  const group = (id, name) => ({
    kind: 'category', name, colour: colours[id],
    contents: robotBlocks.filter(item => item.group === id).flatMap(({ type, args0 }) => {
      const motorField = (id === 'motor' && args0?.[0]?.name === 'MOTOR' && devices.motors.some(item => item.enabled))
        ? { MOTOR: devices.motors.find(item => item.enabled).id } : {};
      if (type === 'robot_ps4_event') {
        return [
          makeEntry(type, args0, { EDGE: 'PRESS', BUTTON: '0' }),
          makeEntry(type, args0, { EDGE: 'RELEASE', BUTTON: '0' }),
        ];
      }
      if (type === 'robot_motor_spin') return devices.motors.map(motor => makeEntry(type, args0, { MOTOR: motor.id }));
      return [makeEntry(type, args0, motorField)];
    }),
  });
  return [
    group('motor', 'Motor'),
    ...(profile?.capabilities?.servoControl ? [group('servo', 'Servo')] : []),
    ...(devices.drivetrain.wheels.length ? [group('drive', 'Di chuyển mecanum')] : []),
    ...(devices.controller.enabled && profile?.capabilities?.fast4wd ? [group('ps4', 'Tay cầm PS4')] : []),
  ];
}
