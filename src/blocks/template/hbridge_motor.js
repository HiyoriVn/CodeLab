export const TYPE = 'codelab_hbridge_motor';

export const block = {
  init() {
    this.appendValueInput('IN1').setCheck('Number').appendField('driver IN1');
    this.appendValueInput('IN2').setCheck('Number').appendField('IN2');
    this.appendEndRowInput();
    this.appendValueInput('PWM').setCheck('Number').appendField('PWM');
    this.appendValueInput('SPEED').setCheck('Number').appendField('tốc độ −255…255');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('Điều khiển một kênh driver H-bridge có hai chân chiều và một chân PWM. Tốc độ âm đảo chiều.');
  },
};

export const toolboxEntry = {
  kind: 'block',
  type: TYPE,
  inputs: {
    IN1: { shadow: { type: 'math_number', fields: { NUM: 4 } } },
    IN2: { shadow: { type: 'math_number', fields: { NUM: 5 } } },
    PWM: { shadow: { type: 'math_number', fields: { NUM: 6 } } },
    SPEED: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
  },
};
