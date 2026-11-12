import { getBoardProfile, DEFAULT_BOARD_ID } from '../boards/profiles.js';
import { roboticsToolbox } from './robotics-toolbox.js';
import './fast4wd.js';
import { defaultRobotDevices } from '../boards/robot-devices.js';
import { robotDeviceToolbox } from './robot-devices.js';
import { CATEGORIES } from './palette.js';

// Missing metadata is a legacy project, which retains the advanced toolbox.
export const projectEditorMode = project => project?.editorMode === 'beginner' ? 'beginner' : 'advanced';
const block = (type, extra = {}) => ({kind:'block',type,...extra});
const category = (name, colour, contents) => ({kind:'category',name,colour,contents});
const shadow = (type, fields) => ({shadow:{type,fields}});
export function editorToolbox(boardId, mode = 'beginner', devices) {
  const p = getBoardProfile(boardId);
  if (p.capabilities.fast4wd && devices === undefined) devices = defaultRobotDevices(p);
  if (p.capabilities.fast4wd) return {
    kind: 'categoryToolbox',
    contents: [
      category('Bắt đầu & Điều khiển', '#e79b23', [
        block('beginner_start'), block('beginner_forever'), block('beginner_wait'),
        block('controls_if'), block('controls_if',{extraState:{hasElse:true}}),
        block('controls_repeat_ext',{inputs:{TIMES:shadow('math_number',{NUM:5})}}),
        block('controls_whileUntil'), block('controls_for'), block('controls_flow_statements'),
      ]),
      category('Logic', '#5c81a6', [
        ...['logic_boolean','logic_negate','logic_operation','logic_compare'].map(type => block(type)),
      ]),
      category(CATEGORIES.math.name, CATEGORIES.math.colour, [
        ...['math_number','math_arithmetic','math_modulo','math_single','math_random_int','math_round','math_constrain'].map(type => block(type)),
      ]),
      {
        kind: 'category',
        name: CATEGORIES.variable.name,
        custom: 'VARIABLE',
        colour: CATEGORIES.variable.colour,
        contents: [
          block('variables_set',{inputs:{VALUE:shadow('math_number',{NUM:0})}}),
          block('math_change',{inputs:{DELTA:shadow('math_number',{NUM:1})}}),
          block('variables_get'),
        ],
      },
      category('Hiển thị / Serial', CATEGORIES.display.colour, [
        block('beginner_message',{inputs:{VALUE:shadow('text',{TEXT:'Xin chào!'})}}),
        block('beginner_led'),
        block('beginner_led',{fields:{STATE:'LOW'}}), block('beginner_blink'),
        ...['text','text_join','text_print','beginner_serial_ready','codelab_serial_print','codelab_serial_available','codelab_serial_read'].map(type => block(type)),
      ]),
      ...robotDeviceToolbox(devices, p).map(group => group.name === 'Tay cầm PS4'
        ? { ...group, contents: [...group.contents, block('fast4wd_connected')] } : group),
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

// Student catalogue: no advanced, simulated controller, or combined robot blocks.
// Profile-dependent features remain limited by the existing board registry.
export function v1StudentToolbox(boardId) {
  const toolbox = editorToolbox(boardId, 'beginner');
  const allowed = new Set([
    'beginner_start','beginner_forever','beginner_wait','controls_if','controls_repeat_ext','controls_whileUntil',
    'math_number','math_arithmetic','math_modulo','math_single','math_random_int','math_round','math_constrain',
    'logic_compare','logic_operation','logic_boolean','logic_negate',
    'beginner_led','beginner_message','beginner_serial_ready','text','text_join',
  ]);
  return { ...toolbox, contents: toolbox.contents.map(category => category.custom === 'VARIABLE' ? category : {
    ...category, contents: (category.contents || []).filter(item => allowed.has(item.type)),
  }).filter(category => category.custom === 'VARIABLE' || category.contents?.length) };
}
