import * as Blockly from 'blockly';
import { getBoardProfile } from '../boards/profiles.js';

const numberInput = (block, name, label) => block
  .appendValueInput(name)
  .setCheck('Number')
  .appendField(label);

const rowBreak = (block) => { if (typeof block.appendEndRowInput === 'function') block.appendEndRowInput(); };

Blockly.Blocks.codelab_delay_ms = {
  init() {
    numberInput(this, 'DURATION', 'chờ (ms)');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('loop_blocks');
    this.setTooltip('Tạm dừng chương trình trong số mili-giây đã chọn.');
  },
};

Blockly.Blocks.codelab_gpio_write = {
  init() {
    numberInput(this, 'PIN', 'đặt GPIO');
    this.appendDummyInput()
      .appendField('thành')
      .appendField(new Blockly.FieldDropdown([['BẬT', 'HIGH'], ['TẮT', 'LOW']]), 'STATE');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('Đặt chân GPIO ở mức cao hoặc thấp. Kiểm tra sơ đồ chân của bo mạch trước khi dùng.');
  },
};

Blockly.Blocks.codelab_gpio_read = {
  init() {
    numberInput(this, 'PIN', 'đọc GPIO');
    this.setInputsInline(true);
    this.setOutput(true, 'Boolean');
    this.setStyle('logic_blocks');
    this.setTooltip('Đọc mức logic từ một chân GPIO đã cấu hình làm đầu vào.');
  },
};

Blockly.Blocks.codelab_analog_read = {
  init() {
    numberInput(this, 'PIN', 'đọc analog GPIO');
    this.setInputsInline(true);
    this.setOutput(true, 'Number');
    this.setStyle('math_blocks');
    this.setTooltip('Đọc giá trị ADC 12-bit trên GPIO 1–20 của ESP32-S3.');
  },
};

Blockly.Blocks.codelab_pwm_write = {
  init() {
    numberInput(this, 'PIN', 'PWM GPIO');
    numberInput(this, 'DUTY', 'độ rộng 0–255');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('Phát PWM 8-bit ở 5 kHz. Dùng driver phù hợp cho động cơ; không nối động cơ trực tiếp vào GPIO.');
  },
};

Blockly.Blocks.codelab_hbridge_motor = {
  init() {
    numberInput(this, 'IN1', 'driver IN1');
    numberInput(this, 'IN2', 'IN2');
    rowBreak(this);
    numberInput(this, 'PWM', 'PWM');
    numberInput(this, 'SPEED', 'tốc độ −255…255');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('Điều khiển một kênh driver H-bridge có hai chân chiều và một chân PWM. Tốc độ âm đảo chiều.');
  },
};

// Keep channel values M1..M6/S1..S6 stable across profile switching/import.
// Unsupported values remain visible and produce diagnostics, never silently remap.
function channels(block, kind) {
  const profile=getBoardProfile(block.workspace?.codelabBoardId);
  const count=profile.pins[kind].length;
  const prefix=kind==='motors'?'M':'S';
  return Array.from({length:6},(_,i)=>[prefix+(i+1)+(i<count?'':' (không hỗ trợ ở profile này)'),String(i+1)]);
}
function statement(block) { block.setPreviousStatement(true);block.setNextStatement(true);block.setStyle('variable_blocks'); }
Blockly.Blocks.codelab_motor_channel = {init(){
  this.appendDummyInput().appendField('motor').appendField(new Blockly.FieldDropdown(()=>channels(this,'motors')),'CHANNEL');
  numberInput(this,'SPEED','yêu cầu tốc độ −255…255');statement(this);
  this.setTooltip('API dự kiến theo kênh board. Hiện chặn chuyển động: V1 thiếu truth table, V2 chưa có runtime safety/driver. Không phát lệnh tải.');
}};
Blockly.Blocks.codelab_servo_write = {init(){
  this.appendDummyInput().appendField('servo').appendField(new Blockly.FieldDropdown(()=>channels(this,'servos')),'CHANNEL');
  numberInput(this,'ANGLE','yêu cầu góc');statement(this);
  this.setTooltip('Chỉ thiết kế API. Enable/pulse bị chặn khi chưa có power-stable interlock và driver đã xác minh.');
}};
Blockly.Blocks.codelab_servo_disable = {init(){
  this.appendDummyInput().appendField('vô hiệu servo').appendField(new Blockly.FieldDropdown(()=>channels(this,'servos')),'CHANNEL');statement(this);
  this.setTooltip('Đưa signal về INPUT/FLOATING; không bật nguồn, attach PWM hoặc phát xung.');
}};
Blockly.Blocks.codelab_gpio_read_mode = {init(){
  numberInput(this,'PIN','đọc GPIO');
  this.appendDummyInput().appendField(new Blockly.FieldDropdown([['không pull','INPUT'],['pull-up','INPUT_PULLUP'],['pull-down','INPUT_PULLDOWN']]),'MODE');
  this.setOutput(true,'Boolean');this.setStyle('logic_blocks');
}};
Blockly.Blocks.codelab_serial_print = {init(){
  this.appendValueInput('VALUE').appendField('Serial ghi');
  this.appendDummyInput().appendField(new Blockly.FieldDropdown([['thêm dòng mới','LN'],['không xuống dòng','RAW']]),'ENDING');statement(this);
}};
Blockly.Blocks.codelab_serial_available = {init(){this.appendDummyInput().appendField('Serial số byte chờ');this.setOutput(true,'Number');this.setStyle('math_blocks');}};
Blockly.Blocks.codelab_serial_read = {init(){this.appendDummyInput().appendField('Serial đọc byte (−1 nếu rỗng)');this.setOutput(true,'Number');this.setStyle('math_blocks');}};
