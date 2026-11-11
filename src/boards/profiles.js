const baseFqbn = 'esp32:esp32:esp32s3';
const generic = {
  id: 'generic-esp32-s3', name: 'Generic ESP32-S3 (legacy)', mcu: 'ESP32-S3',
  flashMB: null, psramMB: null, psramType: 'board-dependent',
  build: { core: 'esp32:esp32', version: '3.3.7', fqbn: baseFqbn },
  pins: { motors: [], servos: [], encoders: [], strapping: [0,3,45,46], usb: [19,20] },
  capabilities: { digital: true, adc: true, pwm: true, motorChannels: null, servoChannels: null },
  adc: Array.from({length:20}, (_,i)=>i+1), digital: null, reserved: [],
};
const v1 = {
  id: 'newmania-starter-v1', name: 'Newmania Starter V1.0 (test board)',
  mcu: 'ESP32-S3-WROOM-1-N8R2', flashMB: 8, psramMB: 2, psramType: 'QSPI',
  build: { core: 'esp32:esp32', version: '3.3.7', fqbn: baseFqbn + ':FlashSize=8M,PartitionScheme=default_8MB,PSRAM=enabled,USBMode=hwcdc,CDCOnBoot=cdc' },
  pins: { motors: [[35,36],[37,38],[39,40],[41,42]], servos: [12,13,14,15], encoders: [],
    led: 47, buzzer: 17, uart1: {tx:18,rx:21}, i2c: {sda:8,scl:9},
    adc: [1,2,4,5,6,7,10,11], adcExpansion: [3,16], boot: 0,
    strapping: [0,3,45,46], usb: [19,20] },
  capabilities: { digital: true, adc: true, pwm: true, motorChannels: 4, servoChannels: 4, motorControl: false, servoControl: false },
  adc: [1,2,4,5,6,7,10,11,3,16], digital: [1,2,4,5,6,7,10,11,3,16,47],
  reserved: [0,3,8,9,12,13,14,15,17,18,19,20,21,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46],
};
const v2 = {
  id: 'steam-mainboard-v2', name: 'STEAM Robotics Mainboard V2.0 (target board)',
  mcu: 'ESP32-S3-MINI-1-N8', flashMB: 8, psramMB: 0, psramType: 'none',
  build: { core: 'esp32:esp32', version: '3.3.7', fqbn: baseFqbn + ':FlashSize=8M,PartitionScheme=default_8MB,PSRAM=disabled' },
  pins: { motors: [[42,41],[40,39],[38,37],[36,35],[48,34],[33,47]], servos: [14,15,16,17,18,21],
    encoders: [[1,2],[4,5]], i2c: {sda:8,scl:9}, imuAddress: 0x6A,
    uart1: {tx:6,rx:7}, uart0: {tx:43,rx:44}, spi: {sck:12,mosi:11,miso:13,cs:10},
    buzzer:26, boot:0, usb:[19,20], expansion:[3,46,45,6,7,10], strapping:[0,3,45,46] },
  capabilities: { digital: true, adc: false, pwm: false, motorChannels: 6, servoChannels: 6, motorControl: false, servoControl: false },
  adc: [], digital: [3,45,46], reserved: Array.from({length:49},(_,i)=>i),
};
// Separate observed-memory candidate. PCB wiring/module suffix are not verified.
// Only LED47 is exposed for explicitly approved tests; do not reuse N8R2 motor startup.
const v1Opi = {
  id: 'newmania-v1-16m-opi-experimental',
  name: 'Newmania V1 — 16MB/OPI8MB (EXPERIMENTAL, LED only)',
  mcu: 'ESP32-S3 (module suffix unverified)',
  flashMB: 16, psramMB: 8, psramType: 'Octal', experimental: true,
  startupPolicy: 'no-board-gpio',
  build: { core: 'esp32:esp32', version: '3.3.7', fqbn: baseFqbn + ':FlashSize=16M,PartitionScheme=default_8MB,PSRAM=opi,USBMode=hwcdc,CDCOnBoot=cdc' },
  pins: { motors: [], servos: [], encoders: [], led: 47,
    memory: [26,27,28,29,30,31,32,33,34,35,36,37],
    strapping: [0,3,45,46], usb: [19,20] },
  capabilities: { digital: true, adc: false, pwm: true, motorChannels: 0, servoChannels: 0, motorControl: false, servoControl: false },
  adc: [], digital: [47],
  reserved: Array.from({length:49}, (_,i)=>i).filter(pin=>pin!==47),
};
export const FAST4WD_BOARD_ID = 'newmania-fast100-4wd';
const fast4wd = {
  id: FAST4WD_BOARD_ID,
  name: 'Newmania 4WD fast100 (16 MB, PSRAM tắt)',
  mcu: 'ESP32-S3 (bo đã xác minh GPIO35–37)',
  flashMB: 16, psramMB: null, psramType: 'Disabled; GPIO35–37 must be free of memory',
  startupPolicy: 'no-board-gpio',
  build: { core: 'esp32:esp32', version: '3.3.7', fqbn: baseFqbn + ':FlashSize=16M,PartitionScheme=default_8MB,PSRAM=disabled,USBMode=hwcdc,CDCOnBoot=cdc' },
  pins: { motors: [[35,36],[37,38],[39,40],[41,42]], servos: [], encoders: [],
    led: 47, i2c: {sda:8,scl:9}, strapping: [0,3,45,46], usb: [19,20] },
  capabilities: { fast4wd: true, digital: false, adc: false, pwm: false,
    motorChannels: 4, servoChannels: 0, motorControl: false, servoControl: false },
  adc: [], digital: [], reserved: Array.from({length:49}, (_,i)=>i),
};
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const BOARD_PROFILES = freeze([generic,v1,v2,v1Opi,fast4wd]);
export const DEFAULT_BOARD_ID = generic.id;
export function getBoardProfile(id=DEFAULT_BOARD_ID) {
  const profile=BOARD_PROFILES.find(p=>p.id===id);
  if (!profile) throw new Error('Board profile không được hỗ trợ: ' + id);
  return profile;
}
export function validatePin(profile, pin, analog=false) {
  if (!Number.isInteger(pin)) return ['chân GPIO phải là một số nguyên cố định.'];
  const errors=[];
  if (!((pin>=0 && pin<=21)||(pin>=26 && pin<=48))) errors.push('GPIO '+pin+' không tồn tại trên ESP32-S3.');
  if (profile.pins.strapping.includes(pin)) errors.push('GPIO '+pin+' là chân strapping; tránh tải ngoài có thể ảnh hưởng lúc khởi động.');
  if (profile.pins.usb.includes(pin)) errors.push('GPIO '+pin+' dành cho USB; kiểm tra cấu hình bo mạch.');
  if (profile.id===DEFAULT_BOARD_ID) {
    if(pin>=26 && pin<=37) errors.push('GPIO '+pin+' có thể được dùng cho flash/PSRAM tùy module.');
    if(analog && (pin<1||pin>20)) errors.push('ADC của ESP32-S3 chỉ có trên GPIO 1–20.');
  } else {
    if(profile.reserved.includes(pin)) errors.push('GPIO '+pin+' đã được profile giữ cho thiết bị/bus/boot/bộ nhớ; không dùng I/O trực tiếp.');
    if(!profile.digital.includes(pin)) errors.push('GPIO '+pin+' chưa được profile cho phép dùng I/O trực tiếp.');
    if(analog && !profile.adc.includes(pin)) errors.push('GPIO '+pin+' không có trong danh sách ADC được phép của board.');
  }
  return errors;
}
// Optional metadata, no workspace/block schema change. Missing ID preserves old projects.
export function projectBoardId(project) { return getBoardProfile(project?.boardId ?? DEFAULT_BOARD_ID).id; }
