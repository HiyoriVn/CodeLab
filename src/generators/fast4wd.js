import { robotDeviceWarnings } from '../boards/robot-devices.js';

const setupBlocks = new Set(['fast4wd_init', 'fast4wd_connect', 'fast4wd_speed', 'fast4wd_led']);
const logicBlocks = new Set([
  'controls_if', 'controls_repeat_ext', 'beginner_wait',
  'logic_boolean', 'logic_negate', 'logic_operation', 'logic_compare',
  'math_number', 'math_arithmetic', 'variables_set', 'math_change', 'variables_get',
  'beginner_message', 'text',
]);
const actions = {
  fast4wd_drive: 'robot4wd.driveFromPs4();\n',
  fast4wd_stop: 'robot4wd.stop();\n',
};
const axes = ['fast4wd_forward', 'fast4wd_strafe', 'fast4wd_turn'];
const motorBlocks = new Set(['robot_motor_spin', 'robot_motor_for', 'robot_motor_stop', 'robot_motor_release', 'robot_motor_pwm']);
const controllerBlocks = new Set(['robot_ps4_axis', 'robot_ps4_button']);
const numericValueBlocks = new Set(['math_number', 'math_arithmetic', 'variables_get', 'robot_ps4_axis', 'robot_motor_pwm']);
const usesDrivetrain = type => type === 'fast4wd_drive' || type === 'robot_mecanum' || axes.includes(type);

function inStartup(block) {
  for (let parent = block.getParent(); parent; parent = parent.getParent()) {
    if (parent.type === 'beginner_start') return true;
  }
  return false;
}

function inRuntimeHat(block) {
  for (let parent = block.getParent(); parent; parent = parent.getParent()) {
    if (parent.type === 'beginner_start' || parent.type === 'beginner_forever' || parent.type === 'robot_ps4_event') return true;
  }
  return false;
}

export function fast4wdConfig(workspace, profile, devices) {
  const blocks = workspace.getAllBlocks(false).filter(block => block.isEnabled() && !block.getInheritedDisabled());
  if (!profile.capabilities.fast4wd) {
    if (blocks.some(block => block.type.startsWith('robot_'))) {
      return { warnings: ['Profile này hỗ trợ cấu hình theo sơ đồ. PWM và PS4 I2C cho khối robot chưa được xác minh.'] };
    }
    return blocks.some(block => block.type.startsWith('fast4wd_'))
      ? { warnings: ['Chọn board Newmania 4WD fast100 để dùng khối Robot PS4.'] } : null;
  }
  if (devices) {
    const warnings = robotDeviceWarnings(devices, profile);
    if (warnings.length) return { warnings };
  }

  const warnings = new Set();
  const setup = new Map();
  for (const block of blocks) {
    const { type } = block;
    const startup = inStartup(block);
    if (setupBlocks.has(type)) {
      // Startup configuration must be unconditional and directly in the startup stack.
      if (!startup || block.getSurroundParent()?.type !== 'beginner_start') {
        warnings.add('Nối các khối khởi tạo, I2C, tốc độ và đèn trực tiếp trong Khi bắt đầu.');
      }
      if (setup.has(type)) warnings.add('Mỗi khối cấu hình Robot PS4 chỉ được dùng một lần.');
      setup.set(type, block);
    } else if (type === 'beginner_start' || type === 'beginner_forever' || type === 'robot_ps4_event') {
      if (block.getParent()) warnings.add('Đặt Khi bắt đầu, Lặp lại mãi mãi và sự kiện PS4 ở ngoài cùng.');
      if (type === 'robot_ps4_event' && !devices) warnings.add('Lưu Cấu hình robot trước khi thêm sự kiện PS4.');
    } else if (Object.hasOwn(actions, type) || usesDrivetrain(type) || type === 'fast4wd_connected' ||
        logicBlocks.has(type) || motorBlocks.has(type) || controllerBlocks.has(type)) {
      if ((type === 'beginner_wait' || type === 'controls_if' || type === 'controls_repeat_ext' ||
          type === 'variables_set' || type === 'math_change' || type === 'beginner_message' ||
          Object.hasOwn(actions, type) || usesDrivetrain(type) || motorBlocks.has(type)) && !inRuntimeHat(block)) {
        warnings.add('Đặt Wait, điều kiện, vòng lặp và lệnh robot bên trong Khi bắt đầu, sự kiện PS4 hoặc Lặp lại mãi mãi.');
      }
      if (type === 'math_arithmetic' && !['ADD', 'MINUS', 'MULTIPLY', 'DIVIDE'].includes(block.getFieldValue('OP'))) {
        warnings.add('Chỉ hỗ trợ phép toán +, -, *, / trên Robot PS4.');
      }
      if (type === 'variables_set') {
        const val = block.getInputTargetBlock('VALUE');
        if (val && !numericValueBlocks.has(val.type)) warnings.add('Biến trong Robot PS4 chỉ hỗ trợ giá trị số.');
      }
      if (type === 'math_change') {
        const delta = block.getInputTargetBlock('DELTA');
        if (delta && !numericValueBlocks.has(delta.type)) warnings.add('Biến trong Robot PS4 chỉ hỗ trợ giá trị số.');
      }
      if (type === 'text' && block.getParent()?.type !== 'beginner_message') {
        warnings.add('Khối văn bản chỉ dùng trong Hiện lời nhắn trên Robot PS4.');
      }
      // The loop can contain only bounded logic so each iteration services the motor watchdog.
      if (type.startsWith('robot_') && !devices) warnings.add('Lưu Cấu hình robot trước khi dùng các khối mới.');
      if (devices && motorBlocks.has(type) && !devices.motors.some(motor => motor.id === block.getFieldValue('MOTOR') && motor.enabled)) {
        warnings.add('Khối Motor đang chọn thiết bị bị tắt hoặc thiếu trong Cấu hình robot.');
      }
      if (devices && usesDrivetrain(type) && !devices.drivetrain.wheels.length) warnings.add('Cần bật drivetrain và gán đủ bốn bánh.');
    } else {
      warnings.add('Chưa thể dùng khối "' + type + '" tại vị trí này trong chương trình Robot PS4.');
    }
  }
  if (devices && !devices.controller.enabled) warnings.add('Bật Tay cầm PS4 trong Cấu hình robot để dùng ARM và watchdog.');
  if (!devices && (!setup.has('fast4wd_init') || !setup.has('fast4wd_connect'))) {
    warnings.add('Thêm Khởi tạo robot 4 bánh và Kết nối PS4 qua I2C vào Khi bắt đầu.');
  }
  const speed = devices?.drivetrain.limit ?? setup.get('fast4wd_speed')?.getFieldValue('PERCENT') ?? 100;
  if (!Number.isInteger(speed) || speed < 1 || speed > 100) warnings.add('Tốc độ tối đa phải là số nguyên từ 1 đến 100%.');
  return {
    warnings: [...warnings],
    speed,
    blink: devices?.controller.blink ?? setup.has('fast4wd_led'),
    devices,
  };
}

export function registerFast4wdBlocks(generator) {
  for (const type of setupBlocks) generator.forBlock[type] = () => '';
  for (const [type, code] of Object.entries(actions)) generator.forBlock[type] = () => code;
  for (const [axis, type] of axes.entries()) {
    generator.forBlock[type] = block => {
      const sign = block.getFieldValue('DIRECTION') === 'NEGATIVE' ? -1 : 1;
      const values = [0, 0, 0];
      values[axis] = sign;
      return 'robot4wd.move(' + values.join(', ') + ');\n';
    };
  }
  generator.forBlock.fast4wd_connected = () => ['robot4wd.connected()', 0];
  generator.forBlock.beginner_start = () => '';
  generator.forBlock.beginner_forever = (block, gen) => gen.statementToCode(block, 'DO');
  const channel = (block, gen) => gen.fast4wd_.devices.motors.find(item => item.id === block.getFieldValue('MOTOR')).port - 1;
  const value = (block, gen, name) => gen.valueToCode(block, name, 99) || '0';
  const power = (block, gen) => value(block, gen, 'POWER') + ', ' + (block.getFieldValue('DIRECTION') === 'REVERSE');
  generator.forBlock.robot_motor_spin = (block, gen) =>
    `robot4wd.spin(${channel(block, gen)}, ${power(block, gen)});\n`;
  generator.forBlock.robot_motor_for = (block, gen) => {
    const motor = channel(block, gen);
    const start = `robot4wd.spinFor(${motor}, ${power(block, gen)}, ${block.getFieldValue('MS')})`;
    return block.getFieldValue('WAIT') === 'YES'
      ? `if (!${start} || !robot4wd.waitForMotor(${motor})) return;\n`
      : start + ';\n';
  };
  generator.forBlock.robot_motor_stop = (block, gen) => `robot4wd.stopMotor(${channel(block, gen)});\n`;
  generator.forBlock.robot_motor_release = (block, gen) => `robot4wd.releaseMotor(${channel(block, gen)});\n`;
  generator.forBlock.robot_motor_pwm = (block, gen) => [`robot4wd.motorPwm(${channel(block, gen)})`, 0];
  generator.forBlock.robot_mecanum = (block, gen) =>
    `robot4wd.movePercent(${['FORWARD', 'LEFT', 'TURN'].map(name => value(block, gen, name)).join(', ')});\n`;
  generator.forBlock.robot_ps4_axis = block => [`robot4wd.axis(${block.getFieldValue('AXIS')})`, 0];
  generator.forBlock.robot_ps4_button = block => [`robot4wd.button(${block.getFieldValue('BUTTON')})`, 0];
  generator.forBlock.robot_ps4_event = (block, gen) =>
    `if (robot4wd.buttonEdge(${block.getFieldValue('BUTTON')}, ${block.getFieldValue('EDGE') === 'PRESS'})) {\n` +
    gen.statementToCode(block, 'DO') + '}\n';
}

export function fast4wdConstructor({ speed, devices }) {
  if (!devices) return String(speed);
  const byPort = [...devices.motors].sort((a, b) => a.port - b.port);
  const wheels = devices.drivetrain.wheels;
  const slots = byPort.map((motor, i) => wheels.length ? wheels.indexOf(motor.id) : i);
  const mask = flag => byPort.reduce((result, motor, i) => result | (motor[flag] ? 1 << i : 0), 0);
  return `${speed}, {{${slots.join(', ')}}, ${mask('reversed')}, ${mask('enabled')}}`;
}
