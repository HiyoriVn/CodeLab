import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as Vietnamese from 'blockly/msg/vi';
import { generateArduino } from '../generators/arduino.js';
import '../blocks/robotics.js';
import '../blocks/controller.js';

Blockly.setLocale(Vietnamese);

const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Điều khiển',
      categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 5 } } } } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Toán học',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 1 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single', fields: { OP: 'ROOT' } },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int' },
      ],
    },
    {
      kind: 'category',
      name: 'Thiết bị & robot',
      categorystyle: 'variable_category',
      contents: [
        { kind: 'block', type: 'codelab_delay_ms' },
        { kind: 'block', type: 'codelab_gpio_write' },
        { kind: 'block', type: 'codelab_gpio_read' },
        { kind: 'block', type: 'codelab_analog_read' },
        { kind: 'block', type: 'codelab_pwm_write', inputs: { DUTY: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
        { kind: 'block', type: 'codelab_hbridge_motor' },
      ],
    },
    {
      kind: 'category',
      name: 'Tay cầm PS4',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'codelab_ps4_begin_uart', inputs: {
          RX: { shadow: { type: 'math_number', fields: { NUM: 16 } } },
          TX: { shadow: { type: 'math_number', fields: { NUM: 17 } } },
          BAUD: { shadow: { type: 'math_number', fields: { NUM: 115200 } } },
        } },
        { kind: 'block', type: 'codelab_ps4_begin_i2c', inputs: {
          SDA: { shadow: { type: 'math_number', fields: { NUM: 8 } } },
          SCL: { shadow: { type: 'math_number', fields: { NUM: 9 } } },
          ADDRESS: { shadow: { type: 'math_number', fields: { NUM: 48 } } },
        } },
        { kind: 'block', type: 'codelab_ps4_connected' },
        { kind: 'block', type: 'codelab_ps4_axis' },
        { kind: 'block', type: 'codelab_ps4_button' },
      ],
    },
    {
      kind: 'category',
      name: 'Văn bản',
      categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_join' },
      ],
    },
    {
      kind: 'category',
      name: 'Biến',
      categorystyle: 'variable_category',
      custom: 'VARIABLE',
    },
    {
      kind: 'category',
      name: 'Hàm',
      categorystyle: 'procedure_category',
      custom: 'PROCEDURE',
    },
  ],
};

const theme = Blockly.Theme.defineTheme('codelabTheme', {
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#fbfcfa',
    toolboxBackgroundColour: '#f3f6f2',
    toolboxForegroundColour: '#27352b',
    flyoutBackgroundColour: '#eef2ed',
    flyoutForegroundColour: '#27352b',
    flyoutOpacity: 1,
    scrollbarColour: '#aab8ac',
    insertionMarkerColour: '#2d8b57',
    insertionMarkerOpacity: 0.3,
    scrollbarOpacity: 0.5,
    cursorColour: '#354b3b',
  },
});

function BlocklyWorkspace({ initialState, onChange, onCodeChange, workspaceRef }) {
  const hostRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onCodeChangeRef = useRef(onCodeChange);
  const initialStateRef = useRef(initialState);

  useEffect(() => {
    onChangeRef.current = onChange;
    onCodeChangeRef.current = onCodeChange;
  }, [onChange, onCodeChange]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const workspace = Blockly.inject(hostRef.current, {
      toolbox,
      renderer: 'zelos',
      sounds: false,
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.4, minScale: 0.55, scaleSpeed: 1.1 },
      grid: { spacing: 24, length: 3, colour: '#e0e6df', snap: true },
      theme,
    });
    workspaceRef.current = workspace;

    if (initialStateRef.current) {
      try {
        Blockly.serialization.workspaces.load(initialStateRef.current, workspace);
      } catch {
        workspace.clear();
      }
    }

    let saveTimer;
    const save = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        if (workspace.isDragging()) return;
        onChangeRef.current(Blockly.serialization.workspaces.save(workspace));
        onCodeChangeRef.current?.(generateArduino(workspace));
      }, 250);
    };
    workspace.addChangeListener(save);
    onCodeChangeRef.current?.(generateArduino(workspace));

    const resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace));
    resizeObserver.observe(hostRef.current);

    return () => {
      window.clearTimeout(saveTimer);
      resizeObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [workspaceRef]);

  return <div ref={hostRef} className="blockly-host" aria-label="Vùng lắp ghép khối lệnh" />;
}

export default BlocklyWorkspace;
