import * as Blockly from 'blockly';

export const TYPE = 'codelab_gpio_write';

export const block = {
  init() {
    this.appendValueInput('PIN').setCheck('Number').appendField('đặt GPIO');
    this.appendDummyInput()
      .appendField('thành')
      .appendField(new Blockly.FieldDropdown([
        ['BẬT', 'HIGH'],
        ['TẮT', 'LOW'],
      ]), 'STATE');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('Đặt chân GPIO ở mức cao hoặc thấp. Kiểm tra sơ đồ chân của bo mạch trước khi dùng.');
  },
};

export const toolboxEntry = { kind: 'block', type: TYPE };
