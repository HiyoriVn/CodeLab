import { TYPES, previewMotorTypes, designDiagnostics, unsupported } from '../blocks/newmania.js';
import { FAST4WD_BOARD_ID, getBoardProfile } from '../boards/profiles.js';
import { defaultRobotDevices, robotDeviceWarnings } from '../boards/robot-devices.js';
import { fast4wdConstructor } from './fast4wd.js';

const oldMotor = new Map([...previewMotorTypes].map(([old, type]) => [type, old]));
const buttonNames = ['X','Circle','Square','Triangle','L1','R1','L2','R2','Share','Options','L3','R3','Home','Up','Down','Left','Right'];
const axisNames = ['LeftX','LeftY','RightX','RightY'];
const number = value => {
  const n=Number(value);if(!Number.isFinite(n))throw Error('Giá trị số không hữu hạn.');
  return Number.isInteger(n)&&!/[eE]/.test(String(n)) ? `${n}.0` : String(n);
};
const cppString = text => '"'+String(text).replace(/[\\"\x00-\x1f]/g,c=>c==='\\'?'\\\\':c==='"'?'\\"':'\\'+c.charCodeAt(0).toString(8).padStart(3,'0'))+'"';
const uidOf = id => { let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)||1; };

export function generateNewmania(workspace, boardId, deviceConfig) {
  if(boardId!==FAST4WD_BOARD_ID)return {code:'',warnings:['Chương trình Newmania mới chỉ dùng board newmania-fast100-4wd; giữ nguyên board gốc.'],boardId};
  const profile=getBoardProfile(boardId),devices=deviceConfig??defaultRobotDevices(profile);
  const warnings=robotDeviceWarnings(devices,profile);
  if(warnings.length)return {code:'',warnings,boardId};
  const issues=designDiagnostics(workspace);
  if(!devices.controller.enabled)issues.push({id:'PS4',message:'Cấu hình PS4 phải được bật để giữ ARM và watchdog.'});
  if(issues.length)return {code:'',warnings:issues.map(i=>`${i.message} (${i.type??'cấu hình'} · ${i.id})`),boardId};
  let current;
  try {
    const root=workspace.getBlocksByType(TYPES.root,false)[0];
    const variables=workspace.getVariableMap().getAllVariables();
    const typed=variables.find(v=>v.type);
    if(typed)throw Error('Chỉ hỗ trợ biến số; biến chưa chuyển được: '+typed.name+' ('+typed.getId()+').');
    const variableNames=new Map(variables.map((v,i)=>[v.getId(),`student_var_${i}`]));
    const variable=id=>{if(!variableNames.has(id))throw Error('Không tìm thấy biến đã lưu.');return variableNames.get(id);};
    const cursors=new Map(),cases=[];
    const motor=b=>{
      const device=devices.motors.find(m=>m.id===b.getFieldValue('MOTOR')&&m.enabled);
      if(!device)throw Error('Motor đã chọn bị tắt hoặc không có trong cấu hình.');
      return `Motor::M${device.port}`;
    };
    const milliseconds=(b,name,maxSeconds,scale=1000,min=0)=>{
      const n=Number(b.getFieldValue(name));
      if(!Number.isFinite(n)||n<min||n>maxSeconds)throw Error('Thời gian nằm ngoài phạm vi của block.');
      return Math.round(n*scale);
    };
    const dropdown=(b,name,values)=>{
      const selected=b.getFieldValue(name);if(!Object.hasOwn(values,selected))throw Error(`Lựa chọn ${name} chưa hỗ trợ.`);return values[selected];
    };
    const expr=b=>{
      if(!b)return {code:'0.0',kind:'number'};
      current=b;
      const out=(code,kind='number')=>({code,kind});
      switch(b.type) {
        case 'math_number':return out(number(b.getFieldValue('NUM')));
        case 'text':return out(cppString(b.getFieldValue('TEXT')),'text');
        case 'variables_get':return out(variable(b.getFieldValue('VAR')));
        case 'math_arithmetic': {
          const a=value(b,'A'),c=value(b,'B'),op=b.getFieldValue('OP');
          if(op==='POWER')return out(`std::pow(${a}, ${c})`);
          return out(`(${a} ${dropdown(b,'OP',{ADD:'+',MINUS:'-',MULTIPLY:'*',DIVIDE:'/'})} ${c})`);
        }
        case 'logic_boolean':return out(b.getFieldValue('BOOL')==='TRUE'?'true':'false','boolean');
        case 'logic_negate':return out(`(!${value(b,'BOOL','boolean','false')})`,'boolean');
        case 'logic_operation':return out(`(${value(b,'A','boolean','false')} ${dropdown(b,'OP',{AND:'&&',OR:'||'})} ${value(b,'B','boolean','false')})`,'boolean');
        case 'logic_compare': {
          const a=expr(b.getInputTargetBlock('A')),c=expr(b.getInputTargetBlock('B'));
          if(a.kind==='text'||a.kind!==c.kind)throw Error('So sánh cần hai giá trị cùng kiểu số hoặc Boolean.');
          return out(`(${a.code} ${dropdown(b,'OP',{EQ:'==',NEQ:'!=',LT:'<',LTE:'<=',GT:'>',GTE:'>='})} ${c.code})`,'boolean');
        }
        case TYPES.button: {
          const bit=Number(b.getFieldValue('BUTTON'));if(!buttonNames[bit])throw Error('Nút PS4 không hợp lệ.');
          const state=dropdown(b,'STATE',{PRESS:'Pressed',HELD:'Held',RELEASE:'Released'});
          if(state==='Held')return out(`newmania.held(Button::${buttonNames[bit]})`,'boolean');
          if(!cursors.has(b.id))cursors.set(b.id,`student_button_${cursors.size}`);
          return out(`newmania.button(Button::${buttonNames[bit]}, ButtonState::${state}, ${cursors.get(b.id)})`,'boolean');
        }
        case 'robot_ps4_axis': {
          const axis=axisNames[Number(b.getFieldValue('AXIS'))];if(!axis)throw Error('Trục joystick không hợp lệ.');
          return out(`newmania.axis(Axis::${axis})`);
        }
        case 'fast4wd_connected':return out('newmania.connected()','boolean');
        default:
          if(oldMotor.get(b.type)==='robot_motor_pwm')return out(`newmania.motorPwm(${motor(b)})`);
          throw Error(`Khối ${b.type} chưa có biểu thức C++ Newmania.`);
      }
    };
    const value=(b,name,kind='number',fallback='0.0')=>{
      const child=b.getInputTargetBlock(name);if(!child)return fallback;
      const result=expr(child);if(result.kind!==kind)throw Error(`Đầu vào ${name} cần ${kind==='number'?'giá trị số':'điều kiện Boolean'}.`);return result.code;
    };
    const add=(body,block)=>{
      if(cases.length>=1024)throw Error('Chương trình vượt giới hạn 1024 bước.');
      const pc=cases.length+1;cases.push({pc,body,block});return pc;
    };
    const chain=(first,terminal=65535,depth=0)=>{
      const blocks=[];for(let b=first;b;b=b.getNextBlock())blocks.push(b);
      let next=terminal;for(let i=blocks.length-1;i>=0;--i)next=statement(blocks[i],next,depth);return next;
    };
    const driveArgs=b=>{
      if(!devices.drivetrain.wheels.length)throw Error('Cần đủ bốn bánh trong cấu hình di chuyển mecanum.');
      const speed=value(b,'SPEED');
      return dropdown(b,'DIRECTION',{FORWARD:[speed,'0.0','0.0'],BACKWARD:[`-(${speed})`,'0.0','0.0'],STRAFE_LEFT:['0.0',speed,'0.0'],STRAFE_RIGHT:['0.0',`-(${speed})`,'0.0'],TURN_LEFT:['0.0','0.0',speed],TURN_RIGHT:['0.0','0.0',`-(${speed})`]}).join(', ');
    };
    const statement=(b,next,depth)=>{
      current=b;
      if(!b.isEnabled()||b.getInheritedDisabled())throw Error('Khối bị khóa phải được giữ để chỉnh sửa; chưa thể biên dịch chương trình này.');
      if(unsupported.has(b.type))throw Error(unsupported.get(b.type));
      if(b.type===TYPES.forever) {
        const pc=add('',b),body=chain(b.getInputTargetBlock('DO'),pc,depth);
        cases[pc-1].body=`ctx.pc = ${body}; return Board::Step::YIELD;`;return pc;
      }
      if(b.type==='controls_if') {
        let branch=b.getInput('ELSE')?chain(b.getInputTargetBlock('ELSE'),next,depth):next;
        const indices=[];for(let i=0;b.getInput('IF'+i);++i)indices.push(i);
        for(const i of indices.reverse()) {
          const condition=value(b,'IF'+i,'boolean','false'),body=chain(b.getInputTargetBlock('DO'+i),next,depth);
          branch=add(`ctx.pc = (${condition}) ? ${body} : ${branch}; return Board::Step::YIELD;`,b);
        }
        return branch;
      }
      if(b.type==='controls_repeat_ext') {
        if(depth>=4)throw Error('Tối đa bốn vòng lặp hữu hạn lồng nhau.');
        const slot=depth,pc=add('',b),body=chain(b.getInputTargetBlock('DO'),pc,depth+1),count=value(b,'TIMES');
        cases[pc-1].body=`if (!ctx.loopCounters[${slot}]) { ctx.loopCounters[${slot}] = 1; ctx.frameData[${slot*2}] = Board::repeatCount(${count}); ctx.frameData[${slot*2+1}] = 0; }\n`+
          `if (ctx.frameData[${slot*2+1}] >= ctx.frameData[${slot*2}]) { ctx.loopCounters[${slot}] = 0; ctx.pc = ${next}; }\n`+
          `else { ++ctx.frameData[${slot*2+1}]; ctx.pc = ${body}; } return Board::Step::YIELD;`;return pc;
      }
      let action;
      switch(b.type) {
        // Compatibility-only STOP retained in confirmed copies. Not catalogued.
        case 'fast4wd_stop':return add('newmania.stop(); return Board::Step::DONE;',b);
        case TYPES.connect:action='newmania.connectPs4();';break;
        case 'beginner_wait':return add(`return newmania.wait(ctx, ${milliseconds(b,'SECONDS',60)}UL, ${next});`,b);
        case 'variables_set':action=`${variable(b.getFieldValue('VAR'))} = ${value(b,'VALUE')};`;break;
        case 'math_change':action=`${variable(b.getFieldValue('VAR'))} += ${value(b,'DELTA','number','1.0')};`;break;
        case 'beginner_message':action=`newmania.message(${b.getInputTargetBlock('VALUE')?expr(b.getInputTargetBlock('VALUE')).code:'""'});`;break;
        case 'robot_mecanum':
          if(!devices.drivetrain.wheels.length)throw Error('Cần đủ bốn bánh trong cấu hình mecanum.');
          action=`newmania.mecanum(${['FORWARD','LEFT','TURN'].map(n=>value(b,n)).join(', ')});`;break;
        case 'robot_drive_direction':action=`newmania.mecanum(${driveArgs(b)});`;break;
        case 'robot_drive_stop':action='newmania.stopDrive();';break;
        case 'robot_drive_for_time': {
          const ms=milliseconds(b,'SECONDS',60),call=`newmania.driveFor(${driveArgs(b)}, ${ms}UL);`;
          if(b.getFieldValue('WAIT')==='YES')return add(`${call}\nreturn newmania.wait(ctx, ${ms}UL, ${next});`,b);
          action=call;break;
        }
        default: {
          const type=oldMotor.get(b.type);
          if(type==='robot_motor_stop_all')action='newmania.stopAllMotors();';
          else if(type==='robot_motor_stop')action=`newmania.stopMotor(${motor(b)});`;
          else if(type==='robot_motor_release')action=`newmania.releaseMotor(${motor(b)});`;
          else if(type==='robot_motor_power')action=`newmania.power(${motor(b)}, ${value(b,'POWER')});`;
          else if(type==='robot_motor_spin'||type==='robot_motor_for') {
            const direction=dropdown(b,'DIRECTION',{FORWARD:'Forward',REVERSE:'Reverse'}),args=`${motor(b)}, Direction::${direction}, ${value(b,'POWER')}`;
            if(type==='robot_motor_spin')action=`newmania.spin(${args});`;
            else {
              const call=`newmania.runFor(${args}, ${milliseconds(b,'MS',5000,1,1)}UL)`;
              if(b.getFieldValue('WAIT')==='YES')return add(`return newmania.waitMotion(ctx, ${call}, ${next});`,b);
              action=call+';';
            }
          } else throw Error(`Khối ${b.type} chưa có lệnh C++ Newmania.`);
        }
      }
      return add(`${action}\nctx.pc = ${next}; return Board::Step::YIELD;`,b);
    };
    const entry=chain(root.getInputTargetBlock('DO'));
    const constructor=fast4wdConstructor({speed:devices.drivetrain.limit,devices});
    const declarations=[...variableNames.values()].map(n=>`static double ${n} = 0;`);
    for(const cursor of cursors.values())declarations.push(`static ButtonCursor ${cursor};`);
    const reset=[...variableNames.values()].map(n=>`  ${n} = 0;`);
    for(const cursor of cursors.values())reset.push(`  ${cursor} = {};`);
    const body=cases.map(c=>`    case ${c.pc}: { // ${c.block.type} · ${c.block.id.replace(/[^\w-]/g,'_')}\n      ${c.body.replaceAll('\n','\n      ')}\n    }`).join('\n');
    const code=`// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.\n#include <CodeLabNewmania.h>\nusing namespace codelab::newmania;\nstatic Board newmania(${constructor});\n${declarations.join('\n')}\n\nstatic void resetStudent() {\n${reset.join('\n')}\n}\n\nstatic Board::Step studentProgram(Board::Context& ctx, uint32_t) {\n  switch (ctx.pc) {\n    case 0: ctx.pc = ${entry}; return Board::Step::YIELD;\n${body}\n    default: return Board::Step::DONE;\n  }\n}\n\nvoid setup() {\n  newmania.begin(${devices.controller.blink});\n  newmania.registerProgram(${uidOf(root.id)}UL, studentProgram, resetStudent);\n}\n\nvoid loop() {\n  newmania.update();\n}\n`;
    return {code,warnings:[],boardId};
  } catch(error) {
    return {code:'',warnings:[`${error.message}${current?` (${current.type} · ${current.id})`:''}`],boardId};
  }
}
