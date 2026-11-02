import * as Blockly from 'blockly';

export const TYPE = 'codelab_ps4_button';

export const block = {
  init() {
    this.appendDummyInput()
      .appendField('nút PS4')
      .appendField(new Blockly.FieldDropdown([
        ['Cross', 'CROSS'], ['Circle', 'CIRCLE'], ['Square', 'SQUARE'], ['Triangle', 'TRIANGLE'],
        ['L1', 'L1'], ['R1', 'R1'], ['L2', 'L2'], ['R2', 'R2'],
        ['Share', 'SHARE'], ['Options', 'OPTIONS'], ['L3', 'L3'], ['R3', 'R3'], ['PS', 'PS'],
        ['D-pad lên', 'UP'], ['D-pad xuống', 'DOWN'], ['D-pad trái', 'LEFT'], ['D-pad phải', 'RIGHT'],
      ]), 'BUTTON');
    this.setOutput(true, 'Boolean');
    this.setStyle('logic_blocks');
    this.setTooltip('Đọc nút theo bit map giao thức adapter CodeLab.');
  },
};

export const toolboxEntry = { kind: 'block', type: TYPE };
