import * as Blockly from 'blockly';

const numberInput = (block, name, label) => block
  .appendValueInput(name)
  .setCheck('Number')
  .appendField(label);

const rowBreak = (block) => { if (typeof block.appendEndRowInput === 'function') block.appendEndRowInput(); };

Blockly.Blocks.codelab_ps4_begin_uart = {
  init() {
    numberInput(this, 'RX', 'PS4 UART · ESP RX GPIO');
    numberInput(this, 'TX', 'ESP TX GPIO');
    rowBreak(this);
    numberInput(this, 'BAUD', 'baud');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('CodeLab UART adapter: mỗi dòng CSV là connected,lx,ly,rx,ry,buttons. Đặt RX/TX theo sơ đồ bo mạch.');
  },
};

Blockly.Blocks.codelab_ps4_begin_i2c = {
  init() {
    numberInput(this, 'SDA', 'PS4 I2C · SDA GPIO');
    numberInput(this, 'SCL', 'SCL GPIO');
    rowBreak(this);
    numberInput(this, 'ADDRESS', 'địa chỉ');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('CodeLab I2C adapter: đọc khung 13 byte. Đặt GPIO và địa chỉ theo tài liệu phần cứng.');
  },
};

Blockly.Blocks.codelab_ps4_connected = {
  init() {
    this.appendDummyInput().appendField('tay cầm PS4 đã kết nối');
    this.setOutput(true, 'Boolean');
    this.setStyle('logic_blocks');
    this.setTooltip('Sai khi mất gói dữ liệu quá 250 ms; trạng thái trục và nút trở về trung tính.');
  },
};

Blockly.Blocks.codelab_ps4_axis = {
  init() {
    this.appendDummyInput()
      .appendField('trục PS4')
      .appendField(new Blockly.FieldDropdown([
        ['cần trái X', 'LX'],
        ['cần trái Y', 'LY'],
        ['cần phải X', 'RX'],
        ['cần phải Y', 'RY'],
      ]), 'AXIS');
    this.setOutput(true, 'Number');
    this.setStyle('math_blocks');
    this.setTooltip('Giá trị chuẩn hóa −1000…1000; bằng 0 khi mất kết nối.');
  },
};

Blockly.Blocks.codelab_ps4_button = {
  init() {
    this.appendDummyInput()
      .appendField('nút PS4')
      .appendField(new Blockly.FieldDropdown([
        ['Cross', 'CROSS'], ['Circle', 'CIRCLE'], ['Square', 'SQUARE'], ['Triangle', 'TRIANGLE'],
        ['L1', 'L1'], ['R1', 'R1'], ['L2', 'L2'], ['R2', 'R2'],
        ['Share', 'SHARE'], ['Options', 'OPTIONS'], ['L3', 'L3'], ['R3', 'R3'], ['PS', 'PS'],
        ['D-pad lên', 'UP'], ['D-pad xuống', 'DOWN'], ['D-pad trái', 'LEFT'], ['D-pad phải', 'RIGHT'],
      ]), 'BUTTON');
    this.setOutput(true, 'Boolean');
    this.setStyle('logic_blocks');
    this.setTooltip('Đọc nút theo bit map giao thức adapter CodeLab.');
  },
};
