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
  const num = n => shadow('math_number',{NUM:n});
  const controls = [block('beginner_start'),block('beginner_forever'),block('beginner_wait'),
    block('controls_if'),block('controls_if',{extraState:{hasElse:true}}),
    block('controls_repeat_ext',{inputs:{TIMES:num(5)}}),
    block('controls_whileUntil',{fields:{MODE:'UNTIL'},inputs:{BOOL:shadow('logic_boolean',{BOOL:'FALSE'})}})];
  const ps4 = ['beginner_ps4_sim','beginner_ps4_connected','beginner_ps4_button','beginner_ps4_axis'].map(type=>block(type));
  const display = [block('beginner_message',{inputs:{VALUE:shadow('text',{TEXT:'Xin chào!'})}}),block('text'),block('text_join')];
  const math = [block('math_number'),block('math_arithmetic',{inputs:{A:num(1),B:num(1)}}),
    block('math_modulo',{inputs:{DIVIDEND:num(10),DIVISOR:num(3)}}),
    block('math_single',{fields:{OP:'ABS'},inputs:{NUM:num(-5)}}),
    block('math_random_int',{inputs:{FROM:num(1),TO:num(10)}}),
    block('math_round',{inputs:{NUM:num(3.5)}}),
    block('math_constrain',{inputs:{VALUE:num(5),LOW:num(0),HIGH:num(10)}})];
  const logic = ['logic_compare','logic_operation','logic_boolean','logic_negate'].map(type=>block(type));
  const contents = [
    category('Bắt đầu & Điều khiển','#e79b23',controls),
    category('Toán học','#59a34c',math),
    category('Logic','#5c81a6',logic),
    {kind:'category',name:'Biến',custom:'VARIABLE',colour:'#edb070'},
    ...(Number.isInteger(p.pins.led) ? [category('Đèn','#d69a32',[block('beginner_led'),block('beginner_led',{fields:{STATE:'LOW'}}),block('beginner_blink')])] : []),
    category('Hiển thị','#9664d6',display),
    category('Cảm biến','#45a4ad',[block('beginner_serial_ready')]),
    category('Tay cầm PS4 (mô phỏng)','#cf5b9b',ps4),
  ];
  if(advanced) {
    const rawPs4=[];
    if(p.id===DEFAULT_BOARD_ID || p.pins.uart1) rawPs4.push(block('codelab_ps4_begin_uart',{inputs:{RX:shadow('math_number',{NUM:p.pins.uart1?.rx ?? 16}),TX:shadow('math_number',{NUM:p.pins.uart1?.tx ?? 17}),BAUD:shadow('math_number',{NUM:115200})}}));
    // Legacy I2C decoder is exposed only for Generic; no new protocol claims.
    if(p.id===DEFAULT_BOARD_ID) rawPs4.push(block('codelab_ps4_begin_i2c',{inputs:{SDA:shadow('math_number',{NUM:8}),SCL:shadow('math_number',{NUM:9}),ADDRESS:shadow('math_number',{NUM:48})}}));
    contents.push(category('Nâng cao','#68758c',[
      ...roboticsToolbox(boardId),...rawPs4,...(p.pins.uart1 ? [block('beginner_ps4_setup')] : []),
      ...(p.capabilities.motorChannels > 0 ? [block('beginner_motor'),block('beginner_motor_stop')] : []),
      ...(p.capabilities.servoChannels > 0 ? [block('beginner_servo')] : []),
      ...['codelab_ps4_connected','codelab_ps4_axis','codelab_ps4_button','controls_whileUntil','controls_for','controls_flow_statements','math_single','math_modulo','math_random_int','text_print','text_join'].map(type=>block(type)),
      {kind:'category',name:'Biến',custom:'VARIABLE',colour:'#edb070'},
      {kind:'category',name:'Hàm',custom:'PROCEDURE',colour:'#ee9bb0'},
    ]));
  }
  return {kind:'categoryToolbox',contents};
}
