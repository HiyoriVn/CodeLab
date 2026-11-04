export const TYPE = 'codelab_delay_ms';

export const block = {
  init() {
    this.appendValueInput('DURATION')
      .setCheck('Number')
      .appendField('chờ (ms)');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('loop_blocks');
    this.setTooltip('Tạm dừng chương trình trong số mili-giây đã chọn.');
  },
};

export const toolboxEntry = { kind: 'block', type: TYPE };
