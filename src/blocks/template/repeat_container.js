export const TYPE = 'codelab_repeat_example';

export const block = {
  init() {
    this.appendValueInput('TIMES').setCheck('Number').appendField('lặp lại');
    this.appendStatementInput('DO')
      .appendField('thực hiện');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('loop_blocks');
    this.setTooltip('Chạy các khối bên trong nhiều lần.');
  },
};

export const toolboxEntry = {
  kind: 'block',
  type: TYPE,
  inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 5 } } } },
};
