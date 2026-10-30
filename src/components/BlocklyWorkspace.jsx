import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as Vietnamese from 'blockly/msg/vi';
import { generateArduino } from '../generators/arduino.js';
import '../blocks/robotics.js';
import '../blocks/controller.js';
import { RENDERER, FALLBACK_RENDERER } from '../blocks/renderer.js';
import { themes } from '../blocks/theme.js';

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

function BlocklyWorkspace({ initialState, dark = false, onChange, onCodeChange, workspaceRef }) {
  const hostRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onCodeChangeRef = useRef(onCodeChange);
  const initialStateRef = useRef(initialState);
  const darkRef = useRef(dark);

  useEffect(() => {
    onChangeRef.current = onChange;
    onCodeChangeRef.current = onCodeChange;
  }, [onChange, onCodeChange]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const options = {
      toolbox,
      sounds: false,
      trashcan: false,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: false, wheel: true, startScale: 0.9, maxScale: 1.4, minScale: 0.55, scaleSpeed: 1.1 },
      grid: { spacing: 24, length: 3, colour: 'transparent', snap: true },
      theme: darkRef.current ? themes.dark : themes.light,
    };
    let workspace;
    try {
      workspace = Blockly.inject(hostRef.current, { ...options, renderer: RENDERER });
    } catch (error) {
      console.warn('Bộ vẽ khối "codelab" lỗi, chuyển sang zelos.', error);
      hostRef.current.replaceChildren();
      workspace = Blockly.inject(hostRef.current, { ...options, renderer: FALLBACK_RENDERER });
    }
    workspaceRef.current = workspace;

    const flyout = workspace.getFlyout();
    if (flyout) {
      const flyoutScale = workspace.options.zoomOptions?.startScale ?? 0.9;
      flyout.getFlyoutScale = () => flyoutScale;
      flyout.getWorkspace().scale = flyoutScale;
    }

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

    let tagFrame = 0;
    const tagStacks = () => {
      tagFrame = 0;
      workspace.getAllBlocks(false).forEach((block) => {
        const root = block.getSvgRoot?.();
        if (!root) return;
        root.classList.toggle('has-next', !!block.getNextBlock());
        root.classList.toggle('is-nested', !!block.outputConnection && !!block.getParent());
      });
    };
    const scheduleTag = (event) => {
      if (event?.isUiEvent || tagFrame) return;
      tagFrame = window.requestAnimationFrame(tagStacks);
    };
    workspace.addChangeListener(scheduleTag);
    tagStacks();
    onCodeChangeRef.current?.(generateArduino(workspace));

    const tagCategories = () => {
      hostRef.current?.querySelectorAll('.blocklyToolboxCategory').forEach((row, index) => {
        row.style.setProperty('--i', index);
        const colour = row.style.borderLeftColor;
        if (colour && row.style.getPropertyValue('--cat') !== colour) row.style.setProperty('--cat', colour);
      });
    };
    tagCategories();
    const toolboxObserver = new MutationObserver(tagCategories);
    const toolboxDiv = hostRef.current.querySelector('.blocklyToolboxDiv');
    if (toolboxDiv) toolboxObserver.observe(toolboxDiv, { childList: true, subtree: true });

    const resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace));
    resizeObserver.observe(hostRef.current);

    return () => {
      window.clearTimeout(saveTimer);
      window.cancelAnimationFrame(tagFrame);
      resizeObserver.disconnect();
      toolboxObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [workspaceRef]);

  useEffect(() => {
    darkRef.current = dark;
    workspaceRef.current?.setTheme(dark ? themes.dark : themes.light);
  }, [dark, workspaceRef]);

  return <div ref={hostRef} className="blockly-host" aria-label="Vùng lắp ghép khối lệnh" />;
}

export default BlocklyWorkspace;

