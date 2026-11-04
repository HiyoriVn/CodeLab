import * as Blockly from 'blockly';

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
