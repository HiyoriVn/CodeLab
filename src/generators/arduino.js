import * as Blockly from 'blockly';

const ATOMIC = 0;

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
  }

  finish(code) {
    const definitions = Object.values(this.definitions_ || {}).join('\n');
    const includes = ['#include <Arduino.h>', ...Object.values(this.includes_ || {})].join('\n');
    return [
      includes,
      definitions,
      'void setup() {',
      '  Serial.begin(115200);',
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

  generator.forBlock.text = (block) => [JSON.stringify(block.getFieldValue('TEXT') || ''), ATOMIC];

  generator.forBlock.text_print = (block, gen) => {
    const value = gen.valueToCode(block, 'TEXT', ATOMIC) || '""';
    return 'Serial.println(' + value + ');\n';
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
    return {
      code: generator.workspaceToCode(workspace),
      warnings: Array.from(unsupported).map((type) => 'Khối "' + type + '" chưa có bộ sinh Arduino C++; mã xem trước có placeholder.'),
    };
  } catch (error) {
    return {
      code: '// Không thể sinh mã Arduino C++ cho workspace này.\n',
      warnings: ['Lỗi bộ sinh mã: ' + error.message],
    };
  }
}
