import * as Blockly from 'blockly';

export const TYPE = 'codelab_ps4_axis';

export const block = {
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

export const toolboxEntry = { kind: 'block', type: TYPE };
