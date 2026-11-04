export const TYPE = 'codelab_analog_read';

export const block = {
  init() {
    this.appendValueInput('PIN').setCheck('Number').appendField('đọc analog GPIO');
    this.setInputsInline(true);
    this.setOutput(true, 'Number');
    this.setStyle('math_blocks');
    this.setTooltip('Đọc giá trị ADC 12-bit trên GPIO 1–20 của ESP32-S3.');
  },
};

export const toolboxEntry = {
  kind: 'block',
  type: TYPE,
  inputs: { PIN: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
};
