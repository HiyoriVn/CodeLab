import { getBoardProfile, DEFAULT_BOARD_ID } from '../boards/profiles.js';
import { roboticsToolbox } from './robotics-toolbox.js';
import { fast4wdToolbox } from './fast4wd.js';
import { robotDeviceToolbox } from './robot-devices.js';
import { CATEGORIES } from './palette.js';

// Missing metadata is a legacy project, which retains the advanced toolbox.
export const projectEditorMode = project => project?.editorMode === 'beginner' ? 'beginner' : 'advanced';
const block = (type, extra = {}) => ({kind:'block',type,...extra});
const category = (name, colour, contents) => ({kind:'category',name,colour,contents});
const shadow = (type, fields) => ({shadow:{type,fields}});
export function editorToolbox(boardId, mode = 'beginner', devices) {
  const p = getBoardProfile(boardId);
  if (p.capabilities.fast4wd) return {
    kind: 'categoryToolbox',
    contents: [
      category('Bắt đầu & Điều khiển', '#e79b23', [
        ...(devices ? [] : [block('beginner_start')]), block('beginner_forever'), block('beginner_wait'), block('controls_if'),
      ]),
      category('PS4', '#cf5b9b', ['fast4wd_button_pressed','fast4wd_button_released','fast4wd_connected','fast4wd_axis'].map(type=>block(type))),
      category('Logic', '#5c81a6', ['logic_boolean','logic_negate','logic_operation','logic_compare','math_number'].map(type => block(type))),
      devices ? { ...fast4wdToolbox, contents: fast4wdToolbox.contents.filter(({ type }) =>
        type === 'fast4wd_connected' || type === 'fast4wd_stop' ||
        (devices.drivetrain.wheels.length && ['fast4wd_drive','fast4wd_forward','fast4wd_strafe','fast4wd_turn'].includes(type))) }
        : fast4wdToolbox,
      ...robotDeviceToolbox(devices, p),
    ],
  };
  const advanced = mode === 'advanced';
  const num = n => shadow('math_number',{NUM:n});
  const controls = [block('beginner_start'),block('beginner_forever'),block('beginner_wait'),
    block('controls_if'),block('controls_if',{extraState:{hasElse:true}}),
    block('controls_repeat_ext',{inputs:{TIMES:num(5)}}),
    block('controls_whileUntil',{fields:{MODE:'UNTIL'},inputs:{BOOL:shadow('logic_boolean',{BOOL:'FALSE'})}})];
  const ps4 = ['beginner_ps4_sim','beginner_ps4_connected','beginner_ps4_button','beginner_ps4_axis'].map(type=>block(type));
  const display = [block('beginner_message',{inputs:{VALUE:shadow('text',{TEXT:'Xin chào!'})}}),block('text'),block('text_join')];
  const math = [block('math_number'),block('math_arithmetic',{inputs:{A:num(1),B:num(1)}}),
    block('math_modulo',{inputs:{DIVIDEND:num(10),DIVISOR:num(3)} }),
    block('math_single',{fields:{OP:'ABS'},inputs:{NUM:num(-5)}}),
    block('math_random_int',{inputs:{FROM:num(1),TO:num(10)}}),
    block('math_round',{inputs:{NUM:num(3.5)}}),
    block('math_constrain',{inputs:{VALUE:num(5),LOW:num(0),HIGH:num(10)}})];
  const logic = ['logic_compare','logic_operation','logic_boolean','logic_negate'].map(type=>block(type));
  const contents = [
    category(CATEGORIES.control.name,CATEGORIES.control.colour,controls),
    category(CATEGORIES.math.name,CATEGORIES.math.colour,math),
    category(CATEGORIES.logic.name,CATEGORIES.logic.colour,logic),
    {kind:'category',name:CATEGORIES.variable.name,custom:'VARIABLE',colour:CATEGORIES.variable.colour},
    ...(Number.isInteger(p.pins.led) ? [category(CATEGORIES.led.name,CATEGORIES.led.colour,[block('beginner_led'),block('beginner_led',{fields:{STATE:'LOW'}}),block('beginner_blink')])] : []),
    category(CATEGORIES.display.name,CATEGORIES.display.colour,display),
    category(CATEGORIES.sensor.name,CATEGORIES.sensor.colour,[block('beginner_serial_ready')]),
    category(CATEGORIES.ps4.name,CATEGORIES.ps4.colour,ps4),
    ...robotDeviceToolbox(devices, p),
  ];
  if(advanced) {
    const rawPs4=[];
    if(p.id===DEFAULT_BOARD_ID || p.pins.uart1) rawPs4.push(block('codelab_ps4_begin_uart',{inputs:{RX:shadow('math_number',{NUM:p.pins.uart1?.rx ?? 16}),TX:shadow('math_number',{NUM:p.pins.uart1?.tx ?? 17}),BAUD:shadow('math_number',{NUM:115200})}}));
    if(p.id===DEFAULT_BOARD_ID) rawPs4.push(block('codelab_ps4_begin_i2c',{inputs:{SDA:shadow('math_number',{NUM:8}),SCL:shadow('math_number',{NUM:9}),ADDRESS:shadow('math_number',{NUM:48})}}));
    contents.push(category(CATEGORIES.advanced.name,CATEGORIES.advanced.colour,[
      ...roboticsToolbox(boardId),...rawPs4,...(p.pins.uart1 ? [block('beginner_ps4_setup')] : []),
      ...(p.capabilities.motorChannels > 0 ? [block('beginner_motor'),block('beginner_motor_stop')] : []),
      ...(p.capabilities.servoChannels > 0 ? [block('beginner_servo')] : []),
      ...['codelab_ps4_connected','codelab_ps4_axis','codelab_ps4_button','controls_whileUntil','controls_for','controls_flow_statements','math_single','math_modulo','math_random_int','text_print','text_join'].map(type=>block(type)),
      {kind:'category',name:CATEGORIES.variable.name,custom:'VARIABLE',colour:CATEGORIES.variable.colour},
      {kind:'category',name:CATEGORIES.procedure.name,custom:'PROCEDURE',colour:CATEGORIES.procedure.colour},
    ]));
  }
  return {kind:'categoryToolbox',contents};
}
