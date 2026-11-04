export const TYPE = 'codelab_gpio_read';

export const block = {
  init() {
    this.appendValueInput('PIN').setCheck('Number').appendField('đọc GPIO');
    this.setInputsInline(true);
    this.setOutput(true, 'Boolean');
    this.setStyle('logic_blocks');
    this.setTooltip('Đọc mức logic từ một chân GPIO đã cấu hình làm đầu vào.');
  },
};

export const toolboxEntry = {
  kind: 'block',
  type: TYPE,
  inputs: { PIN: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
};
