export const TYPE = 'codelab_pwm_write';

export const block = {
  init() {
    this.appendValueInput('PIN').setCheck('Number').appendField('PWM GPIO');
    this.appendValueInput('DUTY').setCheck('Number').appendField('độ rộng 0–255');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('Phát PWM 8-bit ở 5 kHz. Dùng driver phù hợp cho động cơ; không nối động cơ trực tiếp vào GPIO.');
  },
};

export const toolboxEntry = {
  kind: 'block',
  type: TYPE,
  inputs: { DUTY: { shadow: { type: 'math_number', fields: { NUM: 0 } } } },
};
