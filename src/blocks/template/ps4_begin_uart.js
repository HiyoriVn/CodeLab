export const TYPE = 'codelab_ps4_begin_uart';

export const block = {
  init() {
    this.appendValueInput('RX').setCheck('Number').appendField('PS4 UART · ESP RX GPIO');
    this.appendValueInput('TX').setCheck('Number').appendField('ESP TX GPIO');
    this.appendEndRowInput();
    this.appendValueInput('BAUD').setCheck('Number').appendField('baud');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('variable_blocks');
    this.setTooltip('CodeLab UART adapter: mỗi dòng CSV là connected,lx,ly,rx,ry,buttons. Đặt RX/TX theo sơ đồ bo mạch.');
  },
};

export const toolboxEntry = {
  kind: 'block',
  type: TYPE,
  inputs: {
    RX: { shadow: { type: 'math_number', fields: { NUM: 16 } } },
    TX: { shadow: { type: 'math_number', fields: { NUM: 17 } } },
    BAUD: { shadow: { type: 'math_number', fields: { NUM: 115200 } } },
  },
};
