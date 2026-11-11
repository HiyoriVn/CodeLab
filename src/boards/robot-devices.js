import { getBoardProfile } from './profiles.js';

export const motorIds = Array.from({ length: 6 }, (_, i) => 'motor-' + (i + 1));
export const wheelNames = ['Trước trái', 'Trước phải', 'Sau trái', 'Sau phải'];

export function defaultRobotDevices(profile) {
  const count = profile.pins.motors.length;
  return {
    version: 1,
    motors: motorIds.slice(0, count).map((id, i) => ({
      id, name: 'Motor ' + (i + 1), port: i + 1,
      reversed: Boolean(profile.capabilities.fast4wd && i < 2), enabled: true,
    })),
    drivetrain: { wheels: count >= 4 ? motorIds.slice(0, 4) : [], limit: 100 },
    controller: { enabled: Boolean(profile.capabilities.fast4wd), blink: true },
  };
}

export function robotDeviceWarnings(devices, profile) {
  const count = profile.pins.motors.length;
  if (devices?.version !== 1 || !Array.isArray(devices.motors) || devices.motors.length !== count ||
      !Array.isArray(devices.drivetrain?.wheels) || typeof devices.controller?.enabled !== 'boolean' ||
      typeof devices.controller?.blink !== 'boolean') return ['Cấu hình robot sai định dạng hoặc phiên bản.'];
  const warnings = [];
  for (const [i, motor] of devices.motors.entries()) {
    if (motor?.id !== motorIds[i] || typeof motor.name !== 'string' || !motor.name.trim() || motor.name.length > 40 ||
        !Number.isInteger(motor.port) || motor.port < 1 || motor.port > count ||
        typeof motor.enabled !== 'boolean' || typeof motor.reversed !== 'boolean') {
      warnings.push('Motor ' + (i + 1) + ' cần tên hợp lệ và cổng thuộc board.');
    }
  }
  const { wheels, limit } = devices.drivetrain;
  if (new Set(devices.motors.map(motor => motor?.port)).size !== count) warnings.push('Hai motor không thể dùng chung một cổng.');
  if ((wheels.length !== 0 && wheels.length !== 4) || new Set(wheels).size !== wheels.length ||
      wheels.some(id => !devices.motors.some(motor => motor?.id === id && motor.enabled))) {
    warnings.push('Drivetrain cần bốn motor khác nhau đang bật, hoặc chọn tắt drivetrain.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) warnings.push('Giới hạn PWM phải là số nguyên từ 1–100%.');
  if (devices.controller.enabled && !profile.capabilities.fast4wd) warnings.push('PS4 I2C của cấu hình robot chỉ dành cho fast100.');
  return warnings;
}

export function validateProjectDeviceConfigs(configs) {
  if (configs === undefined) return;
  if (!configs || typeof configs !== 'object' || Array.isArray(configs)) throw new Error('Dữ liệu cấu hình robot không hợp lệ.');
  for (const [boardId, devices] of Object.entries(configs)) {
    const warnings = robotDeviceWarnings(devices, getBoardProfile(boardId));
    if (warnings.length) throw new Error(warnings.join('\n'));
  }
}
