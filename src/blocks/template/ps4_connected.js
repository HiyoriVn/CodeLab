export const TYPE = 'codelab_ps4_connected';

export const block = {
  init() {
    this.appendDummyInput().appendField('tay cầm PS4 đã kết nối');
    this.setOutput(true, 'Boolean');
    this.setStyle('logic_blocks');
    this.setTooltip('Sai khi mất gói dữ liệu quá 250 ms; trạng thái trục và nút trở về trung tính.');
  },
};

export const toolboxEntry = { kind: 'block', type: TYPE };
