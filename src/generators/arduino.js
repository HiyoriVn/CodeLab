import * as Blockly from 'blockly';

const ATOMIC = 0;

function variableTypeOf(block, knownTypes) {
  if (!block) return null;
  if (['math_number', 'math_arithmetic', 'math_single', 'math_modulo', 'codelab_analog_read'].includes(block.type)) return 'number';
  if (['logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate', 'math_number_property', 'codelab_gpio_read'].includes(block.type)) return 'boolean';
  if (['text', 'text_join'].includes(block.type)) return 'string';
  if (block.type === 'variables_get') return knownTypes.get(block.getFieldValue('VAR')) || null;
  return null;
}

function initializeVariables(generator, workspace) {
  const blocks = workspace.getAllBlocks(false);
  const loopVariableIds = new Set(
    blocks.filter((block) => block.type === 'controls_for').map((block) => block.getFieldValue('VAR')),
  );
  const variables = workspace.getAllVariables();
  const knownTypes = new Map();

  for (const id of loopVariableIds) knownTypes.set(id, 'number');

  // Infer simple variable types from assignments. Unresolved or mixed types stay explicit diagnostics.
  for (let pass = 0; pass < variables.length + 1; pass += 1) {
    let changed = false;
    for (const block of blocks) {
      if (block.type !== 'variables_set') continue;
      const id = block.getFieldValue('VAR');
      const inferred = variableTypeOf(block.getInputTargetBlock('VALUE'), knownTypes);
      if (inferred && !knownTypes.has(id)) {
        knownTypes.set(id, inferred);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const assignedTypes = new Map();
  const unresolved = new Set();
  for (const block of blocks) {
    if (block.type !== 'variables_set') continue;
    const id = block.getFieldValue('VAR');
    const valueBlock = block.getInputTargetBlock('VALUE');
    const inferred = variableTypeOf(valueBlock, knownTypes);
    if (!valueBlock || !inferred) unresolved.add(id);
    if (inferred) {
      if (!assignedTypes.has(id)) assignedTypes.set(id, new Set());
      assignedTypes.get(id).add(inferred);
    }
  }

  generator.loopVariableIds_ = loopVariableIds;
  generator.invalidVariableIds_ = new Set();
  generator.variableTypes_ = knownTypes;

  for (const variable of variables) {
    const id = variable.getId();
    if (loopVariableIds.has(id)) {
      const types = assignedTypes.get(id) || new Set();
      if (Array.from(types).some((type) => type !== 'number') || unresolved.has(id)) {
        generator.invalidVariableIds_.add(id);
      }
      generator.variableTypes_.set(id, 'number');
      continue;
    }
    const types = assignedTypes.get(id) || new Set();
    if (types.size > 1 || unresolved.has(id)) {
      generator.invalidVariableIds_.add(id);
      continue;
    }

    const type = types.size === 1 ? Array.from(types)[0] : 'number';
    generator.variableTypes_.set(id, type);
    const name = generator.getVariableName(id);
    const declaration = type === 'string'
      ? 'String ' + name + ' = "";'
      : type === 'boolean'
        ? 'bool ' + name + ' = false;'
        : 'double ' + name + ' = 0;';
    generator.definitions_['variable_' + id] = declaration;
  }
}

class ArduinoGenerator extends Blockly.CodeGenerator {
  constructor() {
    super('Arduino');
    this.ORDER_ATOMIC = ATOMIC;
    this.addReservedWords('setup,loop,Serial,boolean,bool,char,int,long,float,double,void,const,if,else,for,while,break,continue,return,true,false');
  }

  init(workspace) {
    super.init(workspace);
    this.definitions_ = Object.create(null);
    this.repeatIndex_ = 0;
    this.motorIndex_ = 0;
    this.diagnostics_ = new Set();
    this.pinModes_ = new Map();
    this.setupStatements_ = new Map();
    initializeVariables(this, workspace);
  }

  finish(code) {
    const definitions = Object.values(this.definitions_ || {}).join('\n');
    const includes = ['#include <Arduino.h>', ...Object.values(this.includes_ || {})].join('\n');
    return [
      includes,
      definitions,
      'void setup() {',
      '  Serial.begin(115200);',
      ...Array.from(this.setupStatements_.values()).map((line) => '  ' + line),
      '}',
      '',
      'void loop() {',
      code.trimEnd(),
      '}',
      '',
    ].filter((line, index, lines) => line !== '' || (index > 0 && lines[index - 1] !== '')).join('\n');
  }
}

function registerBlocks(generator) {
  generator.forBlock.math_number = (block) => [block.getFieldValue('NUM') || '0', ATOMIC];

  generator.forBlock.logic_boolean = (block) => [
    block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false',
    ATOMIC,
  ];

  generator.forBlock.logic_compare = (block, gen) => {
    const operators = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
    const operator = operators[block.getFieldValue('OP')] || '==';
    const left = gen.valueToCode(block, 'A', ATOMIC) || '0';
    const right = gen.valueToCode(block, 'B', ATOMIC) || '0';
    return ['(' + left + ' ' + operator + ' ' + right + ')', ATOMIC];
  };

  generator.forBlock.logic_operation = (block, gen) => {
    const operator = block.getFieldValue('OP') === 'OR' ? '||' : '&&';
    const left = gen.valueToCode(block, 'A', ATOMIC) || 'false';
    const right = gen.valueToCode(block, 'B', ATOMIC) || 'false';
    return ['(' + left + ' ' + operator + ' ' + right + ')', ATOMIC];
  };

  generator.forBlock.logic_negate = (block, gen) => {
    const value = gen.valueToCode(block, 'BOOL', ATOMIC) || 'false';
    return ['(!' + value + ')', ATOMIC];
  };

  generator.forBlock.math_arithmetic = (block, gen) => {
    const left = gen.valueToCode(block, 'A', ATOMIC) || '0';
    const right = gen.valueToCode(block, 'B', ATOMIC) || '0';
    const operation = block.getFieldValue('OP');
    if (operation === 'POWER') {
      gen.definitions_['include_math'] = '#include <math.h>';
      return ['pow(' + left + ', ' + right + ')', ATOMIC];
    }
    const operators = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' };
    return ['(' + left + ' ' + (operators[operation] || '+') + ' ' + right + ')', ATOMIC];
  };

  generator.forBlock.math_single = (block, gen) => {
    const value = gen.valueToCode(block, 'NUM', ATOMIC) || '0';
    const operation = block.getFieldValue('OP');
    const functions = {
      ABS: 'fabs',
      ROOT: 'sqrt',
      LN: 'log',
      LOG10: 'log10',
      EXP: 'exp',
      ROUND: 'round',
      ROUNDUP: 'ceil',
      ROUNDDOWN: 'floor',
    };
    if (operation === 'NEG') return ['(-' + value + ')', ATOMIC];
    if (operation === 'POW10') {
      gen.definitions_['include_math'] = '#include <math.h>';
      return ['pow(10, ' + value + ')', ATOMIC];
    }
    const fn = functions[operation];
    if (!fn) return ['0 /* unsupported math operation */', ATOMIC];
    gen.definitions_['include_math'] = '#include <math.h>';
    return [fn + '(' + value + ')', ATOMIC];
  };

  generator.forBlock.text = (block) => [JSON.stringify(block.getFieldValue('TEXT') || ''), ATOMIC];

  generator.forBlock.text_join = (block, gen) => {
    const values = block.inputList
      .filter((input) => /^ADD\d+$/.test(input.name))
      .map((input) => 'String(' + (gen.valueToCode(block, input.name, ATOMIC) || '""') + ')');
    return [values.length ? '(' + values.join(' + ') + ')' : 'String("")', ATOMIC];
  };

  generator.forBlock.text_print = (block, gen) => {
    const value = gen.valueToCode(block, 'TEXT', ATOMIC) || '""';
    return 'Serial.println(' + value + ');\n';
  };

  generator.forBlock.variables_get = (block, gen) => {
    const id = block.getFieldValue('VAR');
    if (gen.invalidVariableIds_.has(id)) return ['0 /* unsupported variable type */', ATOMIC];
    return [gen.getVariableName(id), ATOMIC];
  };

  generator.forBlock.variables_set = (block, gen) => {
    const id = block.getFieldValue('VAR');
    if (gen.invalidVariableIds_.has(id)) return '// Unsupported variable assignment: ' + id + '\n';
    const value = gen.valueToCode(block, 'VALUE', ATOMIC) || '0';
    return gen.getVariableName(id) + ' = ' + value + ';\n';
  };


  const pinWarnings = (pin, gen, label, analog = false) => {
    const numericPin = /^-?\d+$/.test(pin) ? Number(pin) : null;
    if (numericPin === null) {
      gen.diagnostics_.add(label + ': chân GPIO phải là một số nguyên cố định.');
      return;
    }
    const valid = (numericPin >= 0 && numericPin <= 21) || (numericPin >= 26 && numericPin <= 48);
    if (!valid) gen.diagnostics_.add(label + ': GPIO ' + numericPin + ' không tồn tại trên ESP32-S3.');
    if ([0, 3, 45, 46].includes(numericPin)) gen.diagnostics_.add(label + ': GPIO ' + numericPin + ' là chân strapping; tránh tải ngoài có thể ảnh hưởng lúc khởi động.');
    if (numericPin === 19 || numericPin === 20) gen.diagnostics_.add(label + ': GPIO ' + numericPin + ' thường được dùng cho USB; kiểm tra cấu hình bo mạch.');
    if (numericPin >= 26 && numericPin <= 37) gen.diagnostics_.add(label + ': GPIO ' + numericPin + ' có thể được dùng cho flash/PSRAM tùy module.');
    if (analog && (numericPin < 1 || numericPin > 20)) gen.diagnostics_.add(label + ': ADC của ESP32-S3 chỉ có trên GPIO 1–20.');
  };

  const numberInput = (block, name, gen, label) => {
    const value = gen.valueToCode(block, name, ATOMIC);
    if (!value) {
      gen.diagnostics_.add(label + ': chưa nối giá trị số.');
      return '0';
    }
    return value;
  };

  const configurePin = (gen, pin, mode, label) => {
    pinWarnings(pin, gen, label);
    const existing = gen.pinModes_.get(pin);
    if (existing && existing !== mode) {
      gen.diagnostics_.add(label + ': cùng chân GPIO được dùng vừa làm ' + existing + ' vừa làm ' + mode + '.');
      return;
    }
    if (!existing) {
      gen.pinModes_.set(pin, mode);
      gen.setupStatements_.set('pin_' + pin, 'pinMode(' + pin + ', ' + mode + ');');
    }
  };

  const configurePwm = (gen, pin, label) => {
    pinWarnings(pin, gen, label);
    const existing = gen.pinModes_.get(pin);
    if (existing && existing !== 'PWM') {
      gen.diagnostics_.add(label + ': cùng chân GPIO được dùng vừa làm ' + existing + ' vừa làm PWM.');
      return;
    }
    gen.pinModes_.set(pin, 'PWM');
    gen.setupStatements_.set('pwm_' + pin, 'if (!ledcAttach(' + pin + ', 5000, 8)) Serial.println("PWM setup failed");');
  };

  generator.forBlock.codelab_delay_ms = (block, gen) => {
    const duration = numberInput(block, 'DURATION', gen, 'Khối chờ');
    return 'delay((uint32_t)max(0.0, (double)(' + duration + ')));\\n';
  };

  generator.forBlock.codelab_gpio_write = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối ghi GPIO');
    configurePin(gen, pin, 'OUTPUT', 'Khối ghi GPIO');
    return 'digitalWrite(' + pin + ', ' + block.getFieldValue('STATE') + ');\\n';
  };

  generator.forBlock.codelab_gpio_read = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối đọc GPIO');
    configurePin(gen, pin, 'INPUT', 'Khối đọc GPIO');
    return ['(digitalRead(' + pin + ') == HIGH)', ATOMIC];
  };

  generator.forBlock.codelab_analog_read = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối đọc ADC');
    pinWarnings(pin, gen, 'Khối đọc ADC', true);
    return ['analogRead(' + pin + ')', ATOMIC];
  };

  generator.forBlock.codelab_pwm_write = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối PWM');
    const duty = numberInput(block, 'DUTY', gen, 'Khối PWM');
    configurePwm(gen, pin, 'Khối PWM');
    return 'ledcWrite(' + pin + ', (uint32_t)constrain((int)(' + duty + '), 0, 255));\\n';
  };

  generator.forBlock.codelab_hbridge_motor = (block, gen) => {
    const in1 = numberInput(block, 'IN1', gen, 'Driver IN1');
    const in2 = numberInput(block, 'IN2', gen, 'Driver IN2');
    const pwm = numberInput(block, 'PWM', gen, 'Driver PWM');
    const speed = numberInput(block, 'SPEED', gen, 'Tốc độ động cơ');
    configurePin(gen, in1, 'OUTPUT', 'Driver IN1');
    configurePin(gen, in2, 'OUTPUT', 'Driver IN2');
    configurePwm(gen, pwm, 'Driver PWM');
    if (new Set([in1, in2, pwm]).size < 3) gen.diagnostics_.add('Driver H-bridge: mỗi IN1, IN2 và PWM cần một GPIO riêng.');
    const id = gen.motorIndex_++;
    const temp = '__codelab_motor_speed_' + id;
    gen.definitions_['include_math'] = '#include <math.h>';
    return 'int ' + temp + ' = constrain((int)(' + speed + '), -255, 255);\\n' +
      'digitalWrite(' + in1 + ', ' + temp + ' >= 0 ? HIGH : LOW);\\n' +
      'digitalWrite(' + in2 + ', ' + temp + ' >= 0 ? LOW : HIGH);\\n' +
      'ledcWrite(' + pwm + ', abs(' + temp + '));\\n';
  };

  generator.forBlock.controls_if = (block, gen) => {
    let code = '';
    let branch = 0;
    while (block.getInput('IF' + branch)) {
      const condition = gen.valueToCode(block, 'IF' + branch, ATOMIC) || 'false';
      const body = gen.statementToCode(block, 'DO' + branch);
      code += (branch === 0 ? 'if' : 'else if') + ' (' + condition + ') {\n' + body + '} ';
      branch += 1;
    }
    if (block.getInput('ELSE')) {
      code += 'else {\n' + gen.statementToCode(block, 'ELSE') + '} ';
    }
    return code.trimEnd() + '\n';
  };

  generator.forBlock.controls_repeat_ext = (block, gen) => {
    const count = gen.valueToCode(block, 'TIMES', ATOMIC) || '0';
    const index = gen.repeatIndex_++;
    const body = gen.statementToCode(block, 'DO');
    const variable = '__codelab_repeat_' + index;
    return 'for (uint32_t ' + variable + ' = 0; ' + variable + ' < (' + count + '); ++' + variable + ') {\n' + body + '}\n';
  };

  generator.forBlock.controls_for = (block, gen) => {
    const variable = gen.getVariableName(block.getFieldValue('VAR'));
    const index = gen.repeatIndex_++;
    const end = gen.getVariableName('__codelab_for_end_' + index);
    const step = gen.getVariableName('__codelab_for_step_' + index);
    const from = gen.valueToCode(block, 'FROM', ATOMIC) || '0';
    const to = gen.valueToCode(block, 'TO', ATOMIC) || '0';
    const by = gen.valueToCode(block, 'BY', ATOMIC) || '1';
    const body = gen.statementToCode(block, 'DO');
    return 'for (double ' + variable + ' = (' + from + '), ' + end + ' = (' + to + '), ' + step + ' = (' + by + '); ' + step + ' != 0 && (' + step + ' > 0 ? ' + variable + ' <= ' + end + ' : ' + variable + ' >= ' + end + '); ' + variable + ' += ' + step + ') {\n' + body + '}\n';
  };

  generator.forBlock.controls_whileUntil = (block, gen) => {
    let condition = gen.valueToCode(block, 'BOOL', ATOMIC) || 'false';
    if (block.getFieldValue('MODE') === 'UNTIL') condition = '(!(' + condition + '))';
    return 'while (' + condition + ') {\n' + gen.statementToCode(block, 'DO') + '}\n';
  };

  generator.forBlock.controls_flow_statements = (block) => (
    block.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n'
  );
}

export function generateArduino(workspace) {
  const generator = new ArduinoGenerator();
  registerBlocks(generator);

  const unsupported = new Set();
  for (const block of workspace.getAllBlocks(false)) {
    if (typeof generator.forBlock[block.type] === 'function') continue;
    unsupported.add(block.type);
    if (block.outputConnection) {
      generator.forBlock[block.type] = () => ['0 /* unsupported: ' + block.type + ' */', ATOMIC];
    } else {
      generator.forBlock[block.type] = () => '// Unsupported block: ' + block.type + '\n';
    }
  }

  try {
    const code = generator.workspaceToCode(workspace);
    const unsupportedVariables = new Set();
    for (const variable of workspace.getAllVariables()) {
      if (generator.invalidVariableIds_.has(variable.getId())) unsupportedVariables.add(variable.name);
    }
    const warnings = Array.from(unsupported).map((type) => 'Khối "' + type + '" chưa có bộ sinh Arduino C++; mã xem trước có placeholder.');
    warnings.push(...generator.diagnostics_);
    for (const name of unsupportedVariables) {
      warnings.push('Biến "' + name + '" có kiểu chưa xác định hoặc bị gán nhiều kiểu; mã xem trước có placeholder.');
    }
    return { code, warnings };
  } catch (error) {
    return {
      code: '// Không thể sinh mã Arduino C++ cho workspace này.\n',
      warnings: ['Lỗi bộ sinh mã: ' + error.message],
    };
  }
}
