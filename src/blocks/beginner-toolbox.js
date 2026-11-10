import { getBoardProfile, DEFAULT_BOARD_ID } from '../boards/profiles.js';
import { roboticsToolbox } from './robotics-toolbox.js';
import { CATEGORIES } from './palette.js';

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
  const rawPs4=[];
  if(advanced) {
    if(p.id===DEFAULT_BOARD_ID || p.pins.uart1) rawPs4.push(block('codelab_ps4_begin_uart',{inputs:{RX:shadow('math_number',{NUM:p.pins.uart1?.rx ?? 16}),TX:shadow('math_number',{NUM:p.pins.uart1?.tx ?? 17}),BAUD:shadow('math_number',{NUM:115200})}}));
    // Legacy I2C decoder is exposed only for Generic; no new protocol claims.
    if(p.id===DEFAULT_BOARD_ID) rawPs4.push(block('codelab_ps4_begin_i2c',{inputs:{SDA:shadow('math_number',{NUM:8}),SCL:shadow('math_number',{NUM:9}),ADDRESS:shadow('math_number',{NUM:48})}}));
  }
  const C = CATEGORIES;
  const hardware = advanced ? roboticsToolbox(boardId) : [];
  const controlsAll = [...controls, ...(advanced ? [block('controls_for'),block('controls_flow_statements'),...hardware.filter(b=>b.type==='codelab_delay_ms')] : [])];
  const displayAll = [...display, ...(advanced ? [block('text_print')] : [])];
  const ps4All = [...ps4, ...(advanced ? [...rawPs4,...(p.pins.uart1 ? [block('beginner_ps4_setup')] : []),...['codelab_ps4_connected','codelab_ps4_axis','codelab_ps4_button'].map(type=>block(type))] : [])];
  const contents = [
    category(C.control.name,C.control.colour,controlsAll),
    category(C.math.name,C.math.colour,math),
    category(C.logic.name,C.logic.colour,logic),
    {kind:'category',name:C.variable.name,custom:'VARIABLE',colour:C.variable.colour},
    ...(advanced ? [{kind:'category',name:C.procedure.name,custom:'PROCEDURE',colour:C.procedure.colour}] : []),
    ...(Number.isInteger(p.pins.led) ? [category(C.led.name,C.led.colour,[block('beginner_led'),block('beginner_led',{fields:{STATE:'LOW'}}),block('beginner_blink')])] : []),
    category(C.display.name,C.display.colour,displayAll),
    category(C.sensor.name,C.sensor.colour,[block('beginner_serial_ready')]),
    category(advanced ? 'Tay cầm PS4' : C.ps4.name,C.ps4.colour,ps4All),
  ];
  if(advanced) {
    contents.push(category(C.advanced.name,C.advanced.colour,[
      ...hardware.filter(b=>b.type!=='codelab_delay_ms'),
      ...(p.capabilities.motorChannels > 0 ? [block('beginner_motor'),block('beginner_motor_stop')] : []),
      ...(p.capabilities.servoChannels > 0 ? [block('beginner_servo')] : []),
    ]));
  }
  return {kind:'categoryToolbox',contents};
}
