export const TYPE = 'codelab_ps4_begin_i2c';

export const block = {
  init() {
    this.appendValueInput('SDA').setCheck('Number').appendField('PS4 I2C · SDA GPIO');
    this.appendValueInput('SCL').setCheck('Number').appendField('SCL GPIO');
    this.appendEndRowInput();
    this.appendValueInput('ADDRESS').setCheck('Number').appendField('địa chỉ');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('CodeLab I2C adapter: đọc khung 13 byte. Đặt GPIO và địa chỉ theo tài liệu phần cứng.');
  },
};

export const toolboxEntry = {
  kind: 'block',
  type: TYPE,
  inputs: {
    SDA: { shadow: { type: 'math_number', fields: { NUM: 8 } } },
    SCL: { shadow: { type: 'math_number', fields: { NUM: 9 } } },
    ADDRESS: { shadow: { type: 'math_number', fields: { NUM: 48 } } },
  },
};
