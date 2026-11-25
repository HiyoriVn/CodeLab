export const D1_DEFAULT_PINS = { i2c: [16, 17], uart: [19, 18] };
export const D1_PINS = [4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];

export function validateD1Config({ mode, first, second } = {}) {
  if (mode !== 'i2c' && mode !== 'uart') throw new Error('Chọn I²C hoặc UART cho ESP32 D1.');
  if (!D1_PINS.includes(first) || !D1_PINS.includes(second) || first === second) {
    throw new Error('Chọn hai GPIO khác nhau, có trong danh sách chân D1.');
  }
  return { mode, first, second };
}
