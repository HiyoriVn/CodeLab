import { getBoardProfile, DEFAULT_BOARD_ID } from '../boards/profiles.js';
import { roboticsToolbox } from './robotics-toolbox.js';

// Missing metadata is a legacy project, which retains the advanced toolbox.
export const projectEditorMode = project => project?.editorMode === 'beginner' ? 'beginner' : 'advanced';
const block = (type, extra = {}) => ({kind:'block',type,...extra});
const category = (name, colour, contents) => ({kind:'category',name,colour,contents});
const shadow = (type, fields) => ({shadow:{type,fields}});
export function editorToolbox(boardId, mode = 'beginner') {
  const p = getBoardProfile(boardId);
  const advanced = mode === 'advanced';
  const controls = ['beginner_start','beginner_forever','beginner_wait','controls_if'].map(type=>block(type));
  controls.push(block('controls_repeat_ext',{inputs:{TIMES:shadow('math_number',{NUM:5})}}));
  const motion = [];
  if(p.capabilities.motorChannels > 0) motion.push(block('beginner_motor'),block('beginner_motor_stop'));
  if(p.capabilities.servoChannels > 0) motion.push(block('beginner_servo'));
  const ps4 = ['beginner_ps4_sim','beginner_ps4_connected','beginner_ps4_button','beginner_ps4_axis'].map(type=>block(type));
  if(p.pins.uart1) ps4.unshift(block('beginner_ps4_setup'));
  const display = [block('beginner_message',{inputs:{VALUE:shadow('text',{TEXT:'Hello!'})}}),block('text')];
  if(Number.isInteger(p.pins.led)) display.unshift(block('beginner_led'),block('beginner_led',{fields:{STATE:'LOW'}}),block('beginner_blink'));
  const contents = [
    category('Bắt đầu & Điều khiển','#e79b23',controls),
    ...(motion.length ? [category('Chuyển động','#4c97ff',motion)] : []),
    category('Cảm biến','#45a4ad',[block('beginner_serial_ready')]),
    category('Tay cầm PS4','#cf5b9b',ps4),
    category('Hiển thị','#9664d6',display),
    category('Toán học & Logic','#59a34c',['math_number','math_arithmetic','logic_compare','logic_operation','logic_boolean','logic_negate'].map(type=>block(type))),
  ];
  if(advanced) {
    const rawPs4=[];
    if(p.id===DEFAULT_BOARD_ID || p.pins.uart1) rawPs4.push(block('codelab_ps4_begin_uart',{inputs:{RX:shadow('math_number',{NUM:p.pins.uart1?.rx ?? 16}),TX:shadow('math_number',{NUM:p.pins.uart1?.tx ?? 17}),BAUD:shadow('math_number',{NUM:115200})}}));
    // Legacy I2C decoder is exposed only for Generic; no new protocol claims.
    if(p.id===DEFAULT_BOARD_ID) rawPs4.push(block('codelab_ps4_begin_i2c',{inputs:{SDA:shadow('math_number',{NUM:8}),SCL:shadow('math_number',{NUM:9}),ADDRESS:shadow('math_number',{NUM:48})}}));
    contents.push(category('Nâng cao','#68758c',[
      ...roboticsToolbox(boardId),...rawPs4,
      ...['codelab_ps4_connected','codelab_ps4_axis','codelab_ps4_button','controls_whileUntil','controls_for','controls_flow_statements','math_single','math_modulo','math_random_int','text_print','text_join'].map(type=>block(type)),
      {kind:'category',name:'Biến',custom:'VARIABLE',colour:'#edb070'},
      {kind:'category',name:'Hàm',custom:'PROCEDURE',colour:'#ee9bb0'},
    ]));
  }
  return {kind:'categoryToolbox',contents};
}
