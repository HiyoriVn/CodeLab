import * as Blockly from 'blockly';

// AXIS remains the sole saved value: 0=LX, 1=LY, 2=RX, 3=RY.
// STICK is a view of that value, including during load and undo/redo.
class StickDropdown extends Blockly.FieldDropdown {
  constructor() { super([['Trái', 'LEFT'], ['Phải', 'RIGHT']]); }
  static fromJson() { return new StickDropdown(); }
  isSerializable() { return false; }
  setValue(value, fireChangeEvent = true) {
    const axis = this.getSourceBlock()?.getField('AXIS');
    if (axis && fireChangeEvent && ['LEFT', 'RIGHT'].includes(value)) {
      axis.setValue(String((value === 'RIGHT' ? 2 : 0) + Number(axis.getValue()) % 2));
      return;
    }
    super.setValue(value, false);
  }
}

class AxisDirectionDropdown extends Blockly.FieldDropdown {
  constructor() {
    super(function () {
      const base = Number(this.getValue()) >= 2 ? 2 : 0;
      return [['Ngang', String(base)], ['Dọc', String(base + 1)]];
    });
  }
  static fromJson() { return new AxisDirectionDropdown(); }
  getOptions() { return super.getOptions(false); }
  // Accept all four historical values even when the other stick is displayed.
  doClassValidation_(value) { return ['0', '1', '2', '3'].includes(value) ? value : null; }
  doValueUpdate_(value) {
    super.doValueUpdate_(value);
    this.getSourceBlock()?.getField('STICK')?.setValue(Number(value) >= 2 ? 'RIGHT' : 'LEFT', false);
  }
}

Blockly.fieldRegistry.register('field_ps4_stick', StickDropdown);
Blockly.fieldRegistry.register('field_ps4_axis_direction', AxisDirectionDropdown);
