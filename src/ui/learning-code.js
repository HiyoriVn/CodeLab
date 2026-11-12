// Presentation only: this text is never passed to a compiler or device.
export function learningCode(workspace) {
  const state = workspace?.blocks ? workspace : { blocks: { blocks: [] } };
  const names = new Map((state.variables || []).map(v => [v.id, v.name]));
  const input = (b, name) => b.inputs?.[name]?.block || b.inputs?.[name]?.shadow;
  const variable = b => names.get(b.fields?.VAR?.id ?? b.fields?.VAR) || b.fields?.VAR?.name || '?';
  const buttons = {0:'X',1:'Tròn',2:'Vuông',3:'Tam giác',4:'L1',5:'R1',13:'Lên',14:'Xuống',15:'Trái',16:'Phải'};
  const expression = b => {
    if (!b) return '0';
    const f = b.fields || {}, e = n => expression(input(b,n));
    switch (b.type) {
      case 'math_number': return String(f.NUM);
      case 'text': return JSON.stringify(f.TEXT);
      case 'variables_get': return variable(b);
      case 'math_arithmetic': return `(${e('A')} ${{ADD:'+',MINUS:'−',MULTIPLY:'×',DIVIDE:'÷',POWER:'^'}[f.OP]} ${e('B')})`;
      case 'math_constrain': return `giới_hạn(${e('VALUE')}, ${e('LOW')}, ${e('HIGH')})`;
      case 'math_single': return f.OP === 'NEG' ? `−(${e('NUM')})` : `${f.OP === 'ABS' ? 'trị_tuyệt_đối' : f.OP}(${e('NUM')})`;
      case 'math_round': return `${f.OP}(${e('NUM')})`;
      case 'math_modulo': return `(${e('DIVIDEND')} % ${e('DIVISOR')})`;
      case 'math_random_int': return `ngẫu_nhiên(${e('FROM')}, ${e('TO')})`;
      case 'logic_boolean': return f.BOOL === 'TRUE' ? 'đúng' : 'sai';
      case 'logic_compare': return `${e('A')} ${{EQ:'=',NEQ:'≠',LT:'<',LTE:'≤',GT:'>',GTE:'≥'}[f.OP]} ${e('B')}`;
      case 'logic_operation': return `(${e('A')} ${f.OP === 'AND' ? 'và' : 'hoặc'} ${e('B')})`;
      case 'logic_negate': return `không (${e('BOOL')})`;
      case 'newmania_design_ps4_button': return `nút ${buttons[f.BUTTON] || f.BUTTON} ${{PRESS:'vừa nhấn',HELD:'đang giữ',RELEASE:'vừa thả'}[f.STATE]}?`;
      case 'robot_ps4_button': return `nút ${buttons[f.BUTTON] || f.BUTTON} đang giữ?`;
      case 'robot_ps4_axis': return ['cần trái ngang','cần trái dọc','cần phải ngang','cần phải dọc'][f.AXIS];
      case 'fast4wd_connected': return 'S3 nhận dữ liệu PS4 I²C còn mới?';
      case 'beginner_serial_ready': return 'Serial có dữ liệu?';
      case 'codelab_serial_available': return 'số byte Serial sẵn có';
      case 'codelab_serial_read': return 'đọc một byte Serial';
      case 'text_join': return Object.keys(b.inputs || {}).filter(n=>/^ADD/.test(n)).map(e).join(' + ');
      default: return `[${b.type}: xem C++ đầy đủ]`;
    }
  };
  const lines = [];
  const emit = (level, text) => lines.push('  '.repeat(level) + text);
  const chain = (first, level = 0) => {
    for (let b = first; b; b = b.next?.block) {
      const f = b.fields || {}, e = n => expression(input(b,n));
      const body = name => chain(input(b,name), level+1);
      const motor = `M${String(f.MOTOR || '').replace('motor-','')}`;
      const type = b.type.replace('newmania_design_robot_', 'robot_');
      switch (type) {
        case 'newmania_design_program': case 'beginner_start': emit(level,'Khi bắt đầu chương trình:'); body('DO'); break;
        case 'newmania_design_forever': case 'beginner_forever': emit(level,'Lặp mãi mãi:'); body('DO'); break;
        case 'newmania_design_ps4_connect': emit(level,'Chuẩn bị đọc tay cầm PS4 từ D1 qua I²C'); break;
        case 'variables_set': emit(level,`${variable(b)} ← ${e('VALUE')}`); break;
        case 'math_change': emit(level,`${variable(b)} ← ${variable(b)} + ${e('DELTA')}`); break;
        case 'beginner_wait': emit(level,`Đợi ${f.SECONDS} giây (vẫn phục vụ an toàn)`); break;
        case 'beginner_message': emit(level,`In Serial: ${e('VALUE')}`); break;
        case 'text_print': emit(level,`In Serial: ${e('TEXT')}`); break;
        case 'codelab_serial_print': emit(level,`In Serial${f.ENDING === 'LN' ? ' và xuống dòng' : ''}: ${e('VALUE')}`); break;
        case 'robot_motor_power': emit(level,`${motor} công suất ${e('POWER')} %`); break;
        case 'robot_motor_spin': case 'robot_motor_for': emit(level,`${motor} quay ${f.DIRECTION === 'REVERSE' ? 'ngược' : 'thuận'} ${e('POWER')} %${type.endsWith('_for') ? ` trong ${f.MS} ms (${f.WAIT === 'YES' ? 'có chờ' : 'không chờ'})` : ''}`); break;
        case 'robot_motor_stop': emit(level,`Dừng ${motor}`); break;
        case 'robot_motor_stop_all': emit(level,'Dừng tất cả motor'); break;
        case 'robot_motor_release': emit(level,`Trả quyền điều khiển ${motor} về drivetrain`); break;
        case 'controls_if':
          for (let i=0; b.inputs?.['IF'+i]; i++) { emit(level,`${i ? 'Nếu không, nếu' : 'Nếu'} ${e('IF'+i)}:`); body('DO'+i); }
          if (b.inputs?.ELSE) { emit(level,'Nếu không:'); body('ELSE'); } break;
        case 'controls_repeat_ext': emit(level,`Lặp ${e('TIMES')} lần:`); body('DO'); break;
        case 'controls_whileUntil': emit(level,`${f.MODE === 'UNTIL' ? 'Lặp đến khi' : 'Lặp khi'} ${e('BOOL')}:`); body('DO'); break;
        case 'controls_for': emit(level,`Đếm ${variable(b)} từ ${e('FROM')} đến ${e('TO')}, bước ${e('BY')}:`); body('DO'); break;
        case 'controls_flow_statements': emit(level,f.FLOW === 'BREAK' ? 'Thoát vòng lặp' : 'Tiếp tục vòng lặp'); break;
        default: emit(level,`[${b.type}: xem Arduino C++ đầy đủ để biết hành vi]`);
      }
    }
  };
  for (const block of state.blocks?.blocks || []) chain(block);
  return lines.join('\n');
}

export function previewCpp(code = '') {
  // Remove only known generated annotations; leave strings and student code intact.
  return code.replace(/^\/\/ Newmania ESP32S3 Board — một chương trình chính, chờ không chặn\.\r?\n/, '')
    .replace(/(case \d+: \{) \/\/ [\w]+ · [\w-]+(?=\r?$)/gm, '$1');
}
