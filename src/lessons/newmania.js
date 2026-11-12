import { FAST4WD_BOARD_ID, getBoardProfile } from '../boards/profiles.js';
import { defaultRobotDevices } from '../boards/robot-devices.js';
import { TYPES, NEWMANIA_MODEL, previewMotorTypes } from '../blocks/newmania.js';

export const LESSONS = [
  { id:'serial_counter', label:'Bài 01 — Serial Counter' },
  { id:'ps4_connection', label:'Bài 02 — PS4 Connection' },
  { id:'motor_test', label:'Bài 03 — Kiểm tra từng Motor' },
  { id:'four_wheels', label:'Bài 04 — Di chuyển 4 bánh cơ bản' },
  { id:'joystick_math', label:'Bài 05 — Mecanum bằng hai Joystick' },
];

// Baseline sources: defaultRobotDevices, fast4wdConstructor, MotorLayout and
// MecanumMixer: M1=FL, M2=FR, M3=RL, M4=RR. Motor API applies reversal itself.
// Never embed physical GPIO or apply M1/M2 inversion a second time here.
export function lessonProject(id) {
  const lesson = LESSONS.find(item => item.id === id);
  if (!lesson) throw new Error('Bài mẫu chưa được hỗ trợ.');
  let sequence = 0;
  const prefix=id==='ps4_connection'?'ps4_link':id;
  const variables = new Map();
  const b = (type, fields = {}, inputs = {}) => ({type,id:`${prefix}-${sequence++}`,fields,
    ...(Object.keys(inputs).length ? {inputs:Object.fromEntries(Object.entries(inputs).map(([name,block])=>[name,{block}]))} : {})});
  const num = n => b('math_number',{NUM:n});
  const text = s => b('text',{TEXT:s});
  const ref = name => {
    if (!variables.has(name)) variables.set(name,{name,id:`${id}-var-${variables.size}`});
    return {id:variables.get(name).id};
  };
  const get = name => b('variables_get',{VAR:ref(name)});
  const set = (name,value) => b('variables_set',{VAR:ref(name)},{VALUE:value});
  const op = (operator,a,c) => b('math_arithmetic',{OP:operator},{A:a,B:c});
  const unary = (operator,value) => b('math_single',{OP:operator},{NUM:value});
  const compare = (operator,a,c) => b('logic_compare',{OP:operator},{A:a,B:c});
  const button = (bit,state='HELD') => b(TYPES.button,{BUTTON:String(bit),STATE:state});
  const axis = index => b('robot_ps4_axis',{STICK:index < 2 ? 'LEFT' : 'RIGHT',AXIS:String(index)});
  const join = (...blocks) => {
    const parts=blocks.flat().filter(Boolean);
    parts.forEach((block,i)=>{
      let tail=block;
      while(tail.next?.block) tail=tail.next.block;
      if(parts[i+1])tail.next={block:parts[i+1]};
    });
    return parts[0];
  };
  const condition = (test,yes,no) => ({...b('controls_if',{}, {IF0:test,DO0:yes,...(no?{ELSE:no}:{})}),...(no?{extraState:{hasElse:true}}:{})});
  const motor = (channel,power) => b(previewMotorTypes.get('robot_motor_power'),{MOTOR:'motor-'+channel},{POWER:power});
  const stop = channel => b(previewMotorTypes.get('robot_motor_stop'),{MOTOR:'motor-'+channel});
  const powers = values => join(...values.map((n,i)=>motor(i+1,num(n))));
  let setup, body;
  if (id === 'serial_counter') {
    setup=set('dem',num(0));
    body=join(b('beginner_wait',{SECONDS:0.5}),b('math_change',{VAR:ref('dem')},{DELTA:num(1)}),b('beginner_message',{}, {VALUE:get('dem')}));
  } else if (id === 'ps4_connection') {
    setup=set('trang_thai_cu',num(-1));
    const report=(value,message)=>join(b('beginner_message',{}, {VALUE:text(message)}),set('trang_thai_cu',num(value)));
    body=join(condition(b('fast4wd_connected'),
      condition(compare('NEQ',get('trang_thai_cu'),num(1)),report(1,'PS4 CONNECTED (S3 I2C)')),
      condition(compare('NEQ',get('trang_thai_cu'),num(0)),report(0,'PS4 DISCONNECTED (S3 I2C)'))),b('beginner_wait',{SECONDS:0.05}));
  } else if (id === 'motor_test') {
    setup=set('chieu',num(1));
    body=join(condition(button(4,'PRESS'),set('chieu',unary('NEG',get('chieu')))),
      ...[13,14,15,16].map((bit,i)=>condition(button(bit),motor(i+1,op('MULTIPLY',num(50),get('chieu'))),stop(i+1))));
  } else if (id === 'four_wheels') {
    // Logical forward ++++, reverse ----, CCW -+-+, CW +-+-.
    body=condition(button(13),powers([30,30,30,30]),
      condition(button(14),powers([-30,-30,-30,-30]),
        condition(button(15),powers([-30,30,-30,30]),
          condition(button(16),powers([30,-30,30,-30]),powers([0,0,0,0])))));
  } else if (id === 'joystick_math') {
    // Raw axis() is -100..100, no deadzone. Use visible blocks for the same
    // 6% rescaled deadzone as CodeLabFast4wd::config; normalize mixed wheels.
    const deadzone = (name,index) => join(set(name,axis(index)),
      condition(compare('LTE',unary('ABS',get(name)),num(6)),set(name,num(0)),
        condition(compare('GT',get(name),num(0)),
          set(name,op('DIVIDE',op('MULTIPLY',op('MINUS',get(name),num(6)),num(100)),num(94))),
          set(name,op('DIVIDE',op('MULTIPLY',op('ADD',get(name),num(6)),num(100)),num(94))))));
    const sum = (a,operator,c,operator2,d) => op(operator2,op(operator,get(a),get(c)),get(d));
    body=join(deadzone('tien',1),deadzone('xoay',0),deadzone('ngang',2),
      set('m1',sum('tien','MINUS','ngang','MINUS','xoay')),
      set('m2',sum('tien','ADD','ngang','ADD','xoay')),
      set('m3',sum('tien','ADD','ngang','MINUS','xoay')),
      set('m4',sum('tien','MINUS','ngang','ADD','xoay')),
      set('dinh',num(100)),
      ...[1,2,3,4].map(i=>condition(compare('GT',unary('ABS',get('m'+i)),get('dinh')),set('dinh',unary('ABS',get('m'+i))))),
      ...[1,2,3,4].map(i=>motor(i,b('math_constrain',{}, {
        VALUE:op('MULTIPLY',op('DIVIDE',get('m'+i),get('dinh')),num(100)),LOW:num(-100),HIGH:num(100),
      }))));
  }
  const root=b(TYPES.root,{}, {DO:join(id==='serial_counter'?null:b(TYPES.connect),setup,b(TYPES.forever,{}, {DO:body}))});
  root.x=40;root.y=40;root.deletable=false;
  const devices=defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID));
  return {name:lesson.label,boardId:FAST4WD_BOARD_ID,programModel:NEWMANIA_MODEL,editorMode:'beginner',
    deviceConfigs:{[FAST4WD_BOARD_ID]:devices},
    workspace:{...(variables.size?{variables:[...variables.values()]}:{}),blocks:{languageVersion:0,blocks:[root]}}};
}
