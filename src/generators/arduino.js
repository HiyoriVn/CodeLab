import * as Blockly from 'blockly';

const ATOMIC = 0;

function variableTypeOf(block, knownTypes) {
  if (!block) return null;
  if (['math_number', 'math_arithmetic', 'math_single', 'math_modulo'].includes(block.type)) return 'number';
  if (['logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate', 'math_number_property'].includes(block.type)) return 'boolean';
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
