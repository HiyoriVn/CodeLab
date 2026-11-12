import * as Blockly from 'blockly';
import { getBoardProfile, DEFAULT_BOARD_ID, validatePin } from '../boards/profiles.js';
import { startupCode } from '../boards/startup.js';
import { fast4wdConfig, fast4wdConstructor, registerFast4wdBlocks } from './fast4wd.js';
import { generateV2Scheduler } from './v2-scheduler.js';
import { hasNewmaniaBlocks } from '../blocks/newmania.js';
import { generateNewmania } from './newmania.js';
import { ps4Usage } from './ps4-usage.js';

const ATOMIC = 0;

export const PS4_HELPER = String.raw`class CodeLabPS4Adapter {
  HardwareSerial* serial_ = nullptr;
  uint8_t address_ = 0;
  bool i2c_ = false;
  int16_t axes_[4] = {0, 0, 0, 0};
  uint32_t buttons_ = 0;
  bool receiverConnected_ = false;
  uint32_t lastFrameAt_ = 0;
  char line_[96] = {0};
  size_t lineLength_ = 0;
  bool discardLine_ = false;

  bool hasFrame_ = false;

  static bool unsignedField(const char*& p, uint32_t limit, uint32_t& value) {
    if (*p < '0' || *p > '9') return false;
    value = 0;
    do {
      const uint32_t digit = (uint32_t)(*p - '0');
      if (digit > limit || value > (limit - digit) / 10U) return false;
      value = value * 10U + digit;
      ++p;
    } while (*p >= '0' && *p <= '9');
    return true;
  }

  static bool signedField(const char*& p, int16_t& value) {
    const bool negative = *p == '-';
    if (negative) ++p;
    uint32_t magnitude;
    if (!unsignedField(p, negative ? 32768U : 32767U, magnitude)) return false;
    value = (int16_t)(negative ? -(int32_t)magnitude : (int32_t)magnitude);
    return true;
  }

  void parseLine() {
    const char* p = line_;
    uint32_t connected, buttons;
    int16_t axes[4];
    if (!unsignedField(p, 1U, connected) || *p++ != ',') return;
    for (uint8_t i = 0; i < 4; ++i) {
      if (!signedField(p, axes[i]) || *p++ != ',') return;
    }
    if (!unsignedField(p, UINT32_MAX, buttons) || *p != '\0') return;
    for (uint8_t i = 0; i < 4; ++i) axes_[i] = connected ? axes[i] : 0;
    buttons_ = connected ? buttons : 0;
    receiverConnected_ = connected == 1;
    hasFrame_ = true;
    lastFrameAt_ = millis();
  }

  void readUart() {
    if (!serial_) return;
    while (serial_->available()) {
      const char ch = (char)serial_->read();
      if (ch == '\n') {
        if (lineLength_ && !discardLine_) {
          if (line_[lineLength_ - 1] == '\r') --lineLength_;
          line_[lineLength_] = '\0';
          if (lineLength_) parseLine();
        }
        lineLength_ = 0;
        discardLine_ = false;
      } else if (ch != '\0' && !discardLine_ && lineLength_ < sizeof(line_) - 1) {
        line_[lineLength_++] = ch;
      } else {
        lineLength_ = 0;
        discardLine_ = true;
      }
    }
  }

  static int16_t readI16(uint8_t low, uint8_t high) {
    return (int16_t)((uint16_t)low | ((uint16_t)high << 8));
  }

  void readI2c() {
    if (!i2c_) return;
    const uint8_t received = Wire.requestFrom(address_, (uint8_t)13);
    if (received != 13 || Wire.available() < 13) {
      while (Wire.available()) Wire.read();
      return;
    }
    uint8_t frame[13];
    for (uint8_t i = 0; i < 13; ++i) frame[i] = (uint8_t)Wire.read();
    axes_[0] = readI16(frame[1], frame[2]);
    axes_[1] = readI16(frame[3], frame[4]);
    axes_[2] = readI16(frame[5], frame[6]);
    axes_[3] = readI16(frame[7], frame[8]);
    buttons_ = (uint32_t)frame[9] | ((uint32_t)frame[10] << 8) |
      ((uint32_t)frame[11] << 16) | ((uint32_t)frame[12] << 24);
    receiverConnected_ = (frame[0] & 0x01) != 0;
    hasFrame_ = true;
    lastFrameAt_ = millis();
  }

public:
  void beginUart(HardwareSerial& serial) { serial_ = &serial; i2c_ = false; }
  void beginI2c(uint8_t address) { address_ = address; i2c_ = true; }
  void update() { if (i2c_) readI2c(); else readUart(); }
  bool hasReport() const { return hasFrame_; }
  uint32_t lastReportAt() const { return lastFrameAt_; }
  bool connected() const { return hasFrame_ && receiverConnected_ && (uint32_t)(millis() - lastFrameAt_) <= 250; }
  int axis(uint8_t index) const {
    if (!connected() || index > 3) return 0;
    return (int)map(axes_[index], -32768, 32767, -1000, 1000);
  }
  bool button(uint8_t index) const {
    return connected() && index < 32 && ((buttons_ >> index) & 1U);
  }
};
CodeLabPS4Adapter codelabPs4;`;

function variableTypeOf(block, knownTypes) {
  if (!block) return null;
  if (['math_number', 'math_arithmetic', 'math_single', 'math_modulo', 'math_random_int', 'math_round', 'math_constrain', 'codelab_analog_read', 'codelab_serial_available', 'codelab_serial_read', 'codelab_ps4_axis', 'beginner_ps4_axis', 'robot_ps4_axis', 'robot_motor_pwm'].includes(block.type)) return 'number';
  if (['logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate', 'math_number_property', 'codelab_gpio_read', 'codelab_gpio_read_mode', 'codelab_ps4_connected', 'codelab_ps4_button', 'beginner_ps4_connected', 'beginner_ps4_button', 'beginner_serial_ready', 'robot_ps4_button', 'fast4wd_connected'].includes(block.type)) return 'boolean';
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
    const inferred = !valueBlock && generator.fast4wd_ ? 'number' : variableTypeOf(valueBlock, knownTypes);
    if (!inferred || (generator.fast4wd_ && inferred !== 'number')) unresolved.add(id);
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
  constructor(profile, fast4wd) {
    super('Arduino');
    this.profile_ = profile;
    this.fast4wd_ = fast4wd;
    this.workspace_ = null;
    if (fast4wd) this.addReservedWords('robot4wd,codelabRobotBlocks');
    this.ORDER_ATOMIC = ATOMIC;
    this.addReservedWords('codelabRandom,codelabClamp,codelabRepeatCount,codelabModulo,setup,loop,Serial,boolean,bool,char,int,long,float,double,void,const,if,else,for,while,break,continue,return,true,false');
  }

  init(workspace) {
    super.init(workspace);
    this.workspace_ = workspace;
    this.definitions_ = Object.create(null);
    this.includes_ = Object.create(null);
    this.repeatIndex_ = 0;
    this.motorIndex_ = 0;
    this.diagnostics_ = new Set();
    this.pinModes_ = new Map();
    this.setupStatements_ = new Map();
    this.beginnerStartup_ = [];
    const simulations = workspace.getAllBlocks(false).filter(b => b.type === 'beginner_ps4_sim' && b.isEnabled() && !b.getInheritedDisabled());
    this.beginnerSimulation_ = simulations.length > 0;
    if (simulations.length > 1) this.diagnostics_.add('Chỉ dùng một khối Mô phỏng PS4 để tránh dữ liệu chồng nhau.');
    if (this.beginnerSimulation_) this.addReservedWords('lessonConnected,lessonLX,lessonCross');
    this.loopPreamble_ = '';
    if (this.fast4wd_) {
      const { blink } = this.fast4wd_;
      this.includes_.fast4wd = '#include <CodeLabFast4wd.h>';
      this.definitions_.fast4wd = `static codelab::fast4wd::Robot robot4wd(${fast4wdConstructor(this.fast4wd_)});`;
      const usage=ps4Usage(workspace);
      this.setupStatements_.set('fast4wd', `robot4wd.configureBlockly(${usage.dependent}, ${usage.buttons}UL, ${usage.axes});\nrobot4wd.begin(${blink});`);
      this.loopPreamble_ = 'robot4wd.beginLoop();';
    }
    this.controllerRequested_ = false;
    this.controllerConfigured_ = false;
    this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_);
    this.nameDB_.setVariableMap(workspace.getVariableMap());
    this.nameDB_.populateVariables(workspace);
    initializeVariables(this, workspace);
  }

  scrubNakedValue(code) { return code + ';\n'; }

  scrub_(block, code, thisOnly = false) {
    const next = block.nextConnection?.targetBlock();
    return code + (!thisOnly && next ? this.blockToCode(next) : '');
  }

  finish(code) {
    const startup = startupCode(this.profile_);
    const configuredRobot = Boolean(this.fast4wd_);
    const scheduler = configuredRobot ? generateV2Scheduler(this.workspace_, this) : { definitions: '', setup: '', loop: '' };
    const definitions = [startup.definitions, ...Object.values(this.definitions_ || {}), scheduler.definitions, scheduler.loop].filter(Boolean).join('\n');
    const includes = [...new Set(['#include <Arduino.h>', ...startup.includes, ...Object.values(this.includes_ || {})])].join('\n');
    return [
      includes,
      definitions,
      'void setup() {',
      ...startup.setup.map(line => '  ' + line),
      '  Serial.begin(115200);',
      ...Array.from(this.setupStatements_.values()).map((line) => '  ' + line),
      ...this.beginnerStartup_,
      ...(scheduler.setup ? ['  ' + scheduler.setup.trim().replaceAll('\n', '\n  ')] : []),
      '}',
      '',
      ...(configuredRobot && !scheduler.loop ? ['static void codelabRobotBlocks() {', code.trimEnd(), '}', ''] : []),
      'void loop() {',
      this.loopPreamble_ && !scheduler.loop ? '  ' + this.loopPreamble_ : '',
      configuredRobot && scheduler.loop ? '  robot4wd.beginLoop();\n  codelabSchedulerLoop();' : configuredRobot ? '  codelabRobotBlocks();' : code.trimEnd(),
      ...(this.fast4wd_ ? ['  robot4wd.endLoop();'] : []),
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
    if (operation === 'DIVIDE') return ['((double)(' + left + ') / (double)(' + right + '))', ATOMIC];
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

  generator.forBlock.math_modulo = (block, gen) => {
    gen.definitions_.include_math = '#include <math.h>';
    const a = gen.valueToCode(block, 'DIVIDEND', ATOMIC) || '0';
    const b = gen.valueToCode(block, 'DIVISOR', ATOMIC) || '1';
    const divisor = block.getInputTargetBlock('DIVISOR');
    if (divisor?.type === 'math_number' && Number(divisor.getFieldValue('NUM')) === 0) {
      gen.diagnostics_.add('Không thể chia dư cho 0. Hãy chọn số chia khác 0.');
    }
    gen.definitions_.beginner_modulo = 'double codelabModulo(double a, double b) { if (b == 0) { static bool warned = false; if (!warned) { Serial.println("Khong the chia du cho 0. Hay chon so chia khac 0."); warned = true; } return 0; } return fmod(a, b); }';
    return ['codelabModulo(' + a + ', ' + b + ')', ATOMIC];
  };
  generator.forBlock.math_random_int = (block, gen) => {
    const from = gen.valueToCode(block, 'FROM', ATOMIC) || '0';
    const to = gen.valueToCode(block, 'TO', ATOMIC) || '0';
    gen.definitions_.beginner_random = `int32_t codelabRandom(int32_t a, int32_t b) {
  if (a > b) { int32_t t = a; a = b; b = t; }
  const uint64_t span = (int64_t)b - (int64_t)a + 1;
  const uint64_t range = UINT64_C(1) << 32;
  const uint64_t limit = range - range % span;
  uint64_t sample;
  do { sample = ((uint32_t)random(65536) << 16) | (uint32_t)random(65536); } while (sample >= limit);
  return (int32_t)((int64_t)a + (int64_t)(sample % span));
}`;
    return ['codelabRandom(' + from + ', ' + to + ')', ATOMIC];
  };
  generator.forBlock.math_round = (block, gen) => {
    gen.definitions_.include_math = '#include <math.h>';
    const fn = {ROUND:'round',ROUNDUP:'ceil',ROUNDDOWN:'floor'}[block.getFieldValue('OP')];
    if (!fn) { gen.diagnostics_.add('Phép làm tròn chưa được hỗ trợ.'); return ['0', ATOMIC]; }
    return [fn + '(' + (gen.valueToCode(block, 'NUM', ATOMIC) || '0') + ')', ATOMIC];
  };
  generator.forBlock.math_constrain = (block, gen) => {
    gen.definitions_.beginner_clamp = 'double codelabClamp(double value, double low, double high) { if (low > high) { double t = low; low = high; high = t; } return value < low ? low : (value > high ? high : value); }';
    const value = gen.valueToCode(block, 'VALUE', ATOMIC) || '0';
    const low = gen.valueToCode(block, 'LOW', ATOMIC) || '0';
    const high = gen.valueToCode(block, 'HIGH', ATOMIC) || '0';
    return ['codelabClamp(' + value + ', ' + low + ', ' + high + ')', ATOMIC];
  };
  generator.forBlock.math_change = (block, gen) => {
    const id = block.getFieldValue('VAR');
    if (gen.invalidVariableIds_.has(id) || gen.variableTypes_.get(id) !== 'number') {
      gen.diagnostics_.add('Chỉ thay đổi biến có kiểu số.');
      return '// Cannot change non-numeric variable.\n';
    }
    return gen.getVariableName(id) + ' += ' + (gen.valueToCode(block, 'DELTA', ATOMIC) || '0') + ';\n';
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
    for (const warning of validatePin(gen.profile_, numericPin, analog)) gen.diagnostics_.add(label + ': ' + warning);
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
    return 'delay((uint32_t)max(0.0, (double)(' + duration + ')));\n';
  };

  generator.forBlock.codelab_gpio_write = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối ghi GPIO');
    configurePin(gen, pin, 'OUTPUT', 'Khối ghi GPIO');
    return 'digitalWrite(' + pin + ', ' + block.getFieldValue('STATE') + ');\n';
  };

  generator.forBlock.codelab_gpio_read = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối đọc GPIO');
    configurePin(gen, pin, 'INPUT', 'Khối đọc GPIO');
    return ['(digitalRead(' + pin + ') == HIGH)', ATOMIC];
  };

  generator.forBlock.codelab_analog_read = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối đọc ADC');
    pinWarnings(pin, gen, 'Khối đọc ADC', true);
    configurePin(gen, pin, 'INPUT', 'Khối đọc ADC');
    return ['analogRead(' + pin + ')', ATOMIC];
  };

  generator.forBlock.codelab_pwm_write = (block, gen) => {
    const pin = numberInput(block, 'PIN', gen, 'Khối PWM');
    const duty = numberInput(block, 'DUTY', gen, 'Khối PWM');
    configurePwm(gen, pin, 'Khối PWM');
    return 'ledcWrite(' + pin + ', (uint32_t)constrain((int)(' + duty + '), 0, 255));\n';
  };

  generator.forBlock.codelab_gpio_read_mode = (block, gen) => {
    const pin=numberInput(block,'PIN',gen,'GPIO input mode');
    const mode=block.getFieldValue('MODE');
    configurePin(gen,pin,mode,'GPIO input mode');
    return ['(digitalRead('+pin+') == HIGH)',ATOMIC];
  };
  generator.forBlock.codelab_serial_print = (block, gen) => {
    const value=gen.valueToCode(block,'VALUE',ATOMIC);
    if(!value) gen.diagnostics_.add('Serial: chưa nối giá trị cần ghi.');
    return 'Serial.'+(block.getFieldValue('ENDING')==='RAW'?'print':'println')+'('+(value||'""')+');\n';
  };
  generator.forBlock.codelab_serial_available = () => ['Serial.available()',ATOMIC];
  generator.forBlock.codelab_serial_read = () => ['Serial.read()',ATOMIC];
  const channelPin = (block, gen, kind) => {
    const index=Number(block.getFieldValue('CHANNEL'))-1;
    if(!Number.isInteger(index)||index<0||index>=gen.profile_.pins[kind].length) {
      gen.diagnostics_.add(kind+': kênh không tồn tại trên profile; không remap workspace.');return null;
    }
    return gen.profile_.pins[kind][index];
  };
  generator.forBlock.codelab_motor_channel = (block, gen) => {
    channelPin(block,gen,'motors');
    numberInput(block,'SPEED',gen,'Motor channel');
    gen.diagnostics_.add('Motor chuyển động chưa được hỗ trợ: V1 chưa xác minh truth table; V2 chưa có runtime driver/safety gate. Không phát lệnh tải.');
    return '// Unsupported motor channel request: no actuator code emitted.\n';
  };
  generator.forBlock.codelab_servo_write = (block, gen) => {
    channelPin(block,gen,'servos');
    numberInput(block,'ANGLE',gen,'Servo channel');
    gen.diagnostics_.add('Servo enable/write chưa được hỗ trợ: thiếu power-stable interlock và driver đã xác minh.');
    return '// Unsupported servo write: no pulses emitted.\n';
  };
  generator.forBlock.codelab_servo_disable = (block, gen) => {
    const pin=channelPin(block,gen,'servos');
    if(pin===null) return '// Unsupported servo channel.\n';
    gen.includes_['servo_disable_gpio']='#include <driver/gpio.h>';
    gen.definitions_['servo_disable']=`static void codelabServoDisable(uint8_t pin) {
  const auto gpio = (gpio_num_t)pin;
  const bool inputOk = gpio_set_direction(gpio, GPIO_MODE_INPUT) == ESP_OK;
  const bool pullOk = gpio_set_pull_mode(gpio, GPIO_FLOATING) == ESP_OK;
  if (!inputOk || !pullOk) Serial.println("Servo disable failed");
}`;
    return 'codelabServoDisable('+pin+');\n';
  };

  generator.forBlock.codelab_hbridge_motor = (block, gen) => {
    if (gen.profile_.id !== DEFAULT_BOARD_ID) gen.diagnostics_.add('Board profile chưa cho phép điều khiển motor; block H-bridge generic chỉ dùng trên profile Generic đã kiểm tra wiring.');
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
    return 'int ' + temp + ' = constrain((int)(' + speed + '), -255, 255);\n' +
      'digitalWrite(' + in1 + ', ' + temp + ' >= 0 ? HIGH : LOW);\n' +
      'digitalWrite(' + in2 + ', ' + temp + ' >= 0 ? LOW : HIGH);\n' +
      'ledcWrite(' + pwm + ', abs(' + temp + '));\n';
  };

  const reservePin = (gen, pin, mode, label) => {
    const uart = gen.profile_.pins.uart1;
    if (!(mode === 'UART' && uart && [uart.rx, uart.tx].includes(Number(pin)))) pinWarnings(pin, gen, label);
    const existing = gen.pinModes_.get(pin);
    if (existing && existing !== mode) {
      gen.diagnostics_.add(label + ': GPIO ' + pin + ' đã được dùng cho ' + existing + '.');
    } else {
      gen.pinModes_.set(pin, mode);
    }
  };

  const configureController = (gen, mode, settings) => {
    if (gen.beginnerSimulation_) {
      gen.diagnostics_.add('Chọn PS4 thật hoặc mô phỏng, không dùng cả hai.');
      return;
    }
    if (gen.controllerConfigured_) {
      gen.diagnostics_.add('Chỉ cấu hình một bộ nhận PS4 trong mỗi chương trình.');
      return;
    }
    gen.controllerConfigured_ = true;
    gen.controllerRequested_ = true;
    gen.definitions_['ps4_adapter'] = PS4_HELPER;
    gen.includes_['ps4_stdio'] = '#include <stdio.h>';
    gen.includes_['ps4_wire'] = '#include <Wire.h>';
    gen.loopPreamble_ = 'codelabPs4.update();';
    if (mode === 'UART') {
      gen.setupStatements_.set('ps4_uart', 'Serial1.begin(' + settings.baud + ', SERIAL_8N1, ' + settings.rx + ', ' + settings.tx + '); codelabPs4.beginUart(Serial1);');
    } else {
      gen.setupStatements_.set('ps4_i2c', 'Wire.begin(' + settings.sda + ', ' + settings.scl + '); Wire.setTimeOut(10); codelabPs4.beginI2c(' + settings.address + ');');
    }
  };

  generator.forBlock.codelab_ps4_begin_uart = (block, gen) => {
    const rx = numberInput(block, 'RX', gen, 'PS4 UART RX');
    const tx = numberInput(block, 'TX', gen, 'PS4 UART TX');
    const baud = numberInput(block, 'BAUD', gen, 'PS4 UART baud');
    if (gen.profile_.id === DEFAULT_BOARD_ID) {
      pinWarnings(rx, gen, 'PS4 UART RX');
      pinWarnings(tx, gen, 'PS4 UART TX');
    } else {
      const uart = gen.profile_.pins.uart1;
      if (!uart || Number(rx) !== uart.rx || Number(tx) !== uart.tx) gen.diagnostics_.add('PS4 UART: RX/TX phải khớp UART1 của board profile.');
    }
    if (rx === tx) gen.diagnostics_.add('PS4 UART: RX và TX phải dùng GPIO khác nhau.');
    if (!/^\d+$/.test(baud) || Number(baud) < 1200 || Number(baud) > 2000000) gen.diagnostics_.add('PS4 UART: baud phải nằm trong khoảng 1200–2000000.');
    reservePin(gen, rx, 'UART', 'PS4 UART RX');
    reservePin(gen, tx, 'UART', 'PS4 UART TX');
    configureController(gen, 'UART', { rx, tx, baud });
    return '';
  };

  generator.forBlock.codelab_ps4_begin_i2c = (block, gen) => {
    const sda = numberInput(block, 'SDA', gen, 'PS4 I2C SDA');
    const scl = numberInput(block, 'SCL', gen, 'PS4 I2C SCL');
    const address = numberInput(block, 'ADDRESS', gen, 'PS4 I2C address');
    pinWarnings(sda, gen, 'PS4 I2C SDA');
    pinWarnings(scl, gen, 'PS4 I2C SCL');
    if (sda === scl) gen.diagnostics_.add('PS4 I2C: SDA và SCL phải dùng GPIO khác nhau.');
    if (!/^\d+$/.test(address) || Number(address) < 8 || Number(address) > 119) gen.diagnostics_.add('PS4 I2C: địa chỉ phải nằm trong khoảng 8–119.');
    reservePin(gen, sda, 'I2C', 'PS4 I2C SDA');
    reservePin(gen, scl, 'I2C', 'PS4 I2C SCL');
    configureController(gen, 'I2C', { sda, scl, address });
    return '';
  };

  generator.forBlock.codelab_ps4_connected = (_block, gen) => {
    gen.loopPreamble_ = 'codelabPs4.update();';
    gen.controllerRequested_ = true;
    gen.definitions_['ps4_adapter'] = PS4_HELPER;
    gen.includes_['ps4_stdio'] = '#include <stdio.h>';
    gen.includes_['ps4_wire'] = '#include <Wire.h>';
    return ['codelabPs4.connected()', ATOMIC];
  };

  generator.forBlock.codelab_ps4_axis = (block, gen) => {
    gen.controllerRequested_ = true;
    gen.definitions_['ps4_adapter'] = PS4_HELPER;
    gen.includes_['ps4_stdio'] = '#include <stdio.h>';
    gen.includes_['ps4_wire'] = '#include <Wire.h>';
    gen.loopPreamble_ = 'codelabPs4.update();';
    const axes = { LX: 0, LY: 1, RX: 2, RY: 3 };
    return ['codelabPs4.axis(' + (axes[block.getFieldValue('AXIS')] ?? 0) + ')', ATOMIC];
  };

  generator.forBlock.codelab_ps4_button = (block, gen) => {
    gen.controllerRequested_ = true;
    gen.definitions_['ps4_adapter'] = PS4_HELPER;
    gen.includes_['ps4_stdio'] = '#include <stdio.h>';
    gen.includes_['ps4_wire'] = '#include <Wire.h>';
    gen.loopPreamble_ = 'codelabPs4.update();';
    const buttons = { CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L1: 4, R1: 5, L2: 6, R2: 7, SHARE: 8, OPTIONS: 9, L3: 10, R3: 11, PS: 12, UP: 13, DOWN: 14, LEFT: 15, RIGHT: 16 };
    return ['codelabPs4.button(' + (buttons[block.getFieldValue('BUTTON')] ?? 0) + ')', ATOMIC];
  };

  generator.forBlock.beginner_start = (block, gen) => {
    if (block.getParent()) gen.diagnostics_.add('Đặt khối Khi bắt đầu ở ngoài cùng, không nằm trong khối khác.');
    gen.beginnerStartup_.push(gen.statementToCode(block, 'DO'));
    return '';
  };
  generator.forBlock.beginner_forever = (block, gen) => {
    if (block.getParent()) gen.diagnostics_.add('Đặt khối Lặp lại mãi mãi ở ngoài cùng.');
    return gen.statementToCode(block, 'DO') + 'delay(1);\n';
  };
  generator.forBlock.beginner_wait = block => 'delay(' + Math.round(Number(block.getFieldValue('SECONDS')) * 1000) + ');\n';
  const beginnerLed = gen => {
    const pin = gen.profile_.pins.led;
    if (!Number.isInteger(pin)) {
      gen.diagnostics_.add('Board này chưa có đèn được xác định. Hãy chọn board có đèn trên mạch.');
      return null;
    }
    configurePin(gen, String(pin), 'OUTPUT', 'Đèn trên mạch');
    return pin;
  };
  generator.forBlock.beginner_led = (block, gen) => {
    const pin = beginnerLed(gen);
    return pin === null ? '' : 'digitalWrite(' + pin + ', ' + block.getFieldValue('STATE') + ');\n';
  };
  generator.forBlock.beginner_blink = (block, gen) => {
    const pin = beginnerLed(gen), ms = Math.round(Number(block.getFieldValue('SECONDS')) * 1000);
    return pin === null ? '' : `digitalWrite(${pin}, HIGH);\ndelay(${ms});\ndigitalWrite(${pin}, LOW);\ndelay(${ms});\n`;
  };
  generator.forBlock.beginner_message = (block, gen) => 'Serial.println(' + (gen.valueToCode(block, 'VALUE', ATOMIC) || '"Hello!"') + ');\n';
  generator.forBlock.beginner_serial_ready = () => ['(Serial.available() > 0)', ATOMIC];
  for (const type of ['beginner_motor','beginner_motor_stop','beginner_servo']) {
    generator.forBlock[type] = (block, gen) => {
      const servo = type === 'beginner_servo';
      const channel = Number(block.getFieldValue('CHANNEL'));
      if (channel > (gen.profile_.capabilities[servo ? 'servoChannels' : 'motorChannels'] || 0)) gen.diagnostics_.add('Kênh ' + (servo ? 'S' : 'M') + channel + ' không có trên board đang chọn. Giá trị được giữ nguyên.');
      gen.diagnostics_.add(servo ? 'Chưa thể chạy servo: nguồn và bộ điều khiển an toàn chưa được xác minh. Hãy bỏ khối servo trước khi biên dịch.' : 'Chưa thể chạy động cơ trên board này. Bộ điều khiển motor chưa được nghiệm thu; hãy bỏ khối động cơ trước khi biên dịch.');
      return '';
    };
  }
  generator.forBlock.beginner_ps4_setup = (_block, gen) => {
    const uart = gen.profile_.pins.uart1;
    if (!uart || gen.beginnerSimulation_) {
      gen.diagnostics_.add(gen.beginnerSimulation_ ? 'Chọn PS4 thật hoặc mô phỏng, không dùng cả hai.' : 'Board này chưa có cổng PS4 được xác định. Hãy dùng khối Mô phỏng PS4.');
      return '';
    }
    reservePin(gen, String(uart.rx), 'UART', 'PS4 RX');
    reservePin(gen, String(uart.tx), 'UART', 'PS4 TX');
    configureController(gen, 'UART', {...uart,baud:115200});
    return '';
  };
  generator.forBlock.beginner_ps4_sim = (block, gen) => {
    gen.definitions_.beginner_sim = '// PS4 SIMULATION ONLY: no Bluetooth or actuator commands.\nstatic bool lessonConnected = false;\nstatic int lessonLX = 0;\nstatic bool lessonCross = false;';
    return `lessonConnected = ${block.getFieldValue('CONNECTED') === 'TRUE'};\nlessonLX = lessonConnected ? ${Number(block.getFieldValue('LX'))} : 0;\nlessonCross = lessonConnected && ${block.getFieldValue('PRESSED') === 'TRUE'};\n`;
  };
  generator.forBlock.beginner_ps4_connected = (block, gen) => gen.beginnerSimulation_ ? ['lessonConnected', ATOMIC] : gen.forBlock.codelab_ps4_connected(block, gen);
  generator.forBlock.beginner_ps4_button = (block, gen) => gen.beginnerSimulation_ ? [block.getFieldValue('BUTTON') === 'CROSS' ? 'lessonCross' : 'false', ATOMIC] : gen.forBlock.codelab_ps4_button(block, gen);
  generator.forBlock.beginner_ps4_axis = (block, gen) => gen.beginnerSimulation_ ? [block.getFieldValue('AXIS') === 'LX' ? 'lessonLX' : '0', ATOMIC] : gen.forBlock.codelab_ps4_axis(block, gen);

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
    const variable = gen.nameDB_.getDistinctName('__codelab_repeat_' + index, Blockly.Names.NameType.DEVELOPER_VARIABLE);
    const limit = gen.nameDB_.getDistinctName('__codelab_repeat_limit_' + index, Blockly.Names.NameType.DEVELOPER_VARIABLE);
    gen.definitions_.include_math = '#include <math.h>';
    gen.definitions_.repeat_count = 'uint32_t codelabRepeatCount(double n) { if (!isfinite(n) || n <= 0) return 0; if (n >= UINT32_MAX) return UINT32_MAX; return (uint32_t)n; }';
    return '{\nconst uint32_t ' + limit + ' = codelabRepeatCount(' + count + ');\n' +
      'for (uint32_t ' + variable + ' = 0; ' + variable + ' < ' + limit + '; ++' + variable + ', delay(1)) {\n' + body + '}\n}\n';
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
    return 'while (' + condition + ') {\n  delay(1);\n' + gen.statementToCode(block, 'DO') + '}\n';
  };

  generator.forBlock.controls_flow_statements = (block) => (
    block.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n'
  );
}

export function generateArduino(workspace, boardId = DEFAULT_BOARD_ID, devices) {
  if (hasNewmaniaBlocks(workspace)) return generateNewmania(workspace, boardId, devices);
  const profile = getBoardProfile(boardId);
  const fast4wd = fast4wdConfig(workspace, profile, devices);
  if (fast4wd?.warnings.length) return { code: '', warnings: fast4wd.warnings, boardId };
  const generator = new ArduinoGenerator(profile, fast4wd);
  registerBlocks(generator);
  if (fast4wd) registerFast4wdBlocks(generator);

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
    if (generator.controllerRequested_ && !generator.controllerConfigured_) {
      warnings.push('Tay cầm PS4: thêm khối cấu hình UART hoặc I2C và adapter tương thích trước khi dùng.');
    }
    for (const name of unsupportedVariables) {
      warnings.push('Biến "' + name + '" có kiểu chưa xác định hoặc bị gán nhiều kiểu; mã xem trước có placeholder.');
    }
    return { code, warnings, boardId };
  } catch (error) {
    return {
      code: '// Không thể sinh mã Arduino C++ cho workspace này.\n',
      warnings: ['Lỗi bộ sinh mã: ' + error.message],
    };
  }
}
