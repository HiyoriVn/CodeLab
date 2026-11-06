import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import {generateArduino} from '../src/generators/arduino.js';

function runNative(source) {
  const dir=mkdtempSync(join(tmpdir(),'codelab-generator-'));
  try {
    const cpp=join(dir,'test.cpp'),exe=join(dir,'test.exe');writeFileSync(cpp,source);
    execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',cpp,'-o',exe]);
    execFileSync(exe);
  } finally {rmSync(dir,{recursive:true,force:true});}
}
const number=(w,n)=>{const b=w.newBlock('math_number');b.setFieldValue(n,'NUM');return b;};

test('repeat snapshots the bound, rejects negative and yields including continue',()=>{
  const w=new Blockly.Workspace(),v=w.getVariableMap().createVariable('bound'),runs=w.getVariableMap().createVariable('runs');
  const repeat=w.newBlock('controls_repeat_ext'),get=w.newBlock('variables_get');get.setFieldValue(v.getId(),'VAR');repeat.getInput('TIMES').connection.connect(get.outputConnection);
  const change=w.newBlock('math_change'),inc=w.newBlock('math_change');change.setFieldValue(v.getId(),'VAR');inc.setFieldValue(runs.getId(),'VAR');change.getInput('DELTA').connection.connect(number(w,1).outputConnection);inc.getInput('DELTA').connection.connect(number(w,1).outputConnection);repeat.getInput('DO').connection.connect(change.previousConnection);change.nextConnection.connect(inc.previousConnection);
  const flow=w.newBlock('controls_flow_statements');flow.setFieldValue('CONTINUE','FLOW');inc.nextConnection.connect(flow.previousConnection);
  const out=generateArduino(w);assert.deepEqual(out.warnings,[]);assert.equal((out.code.match(/codelabRepeatCount\(bound\)/g)||[]).length,1);
  const src=out.code.replace('#include <Arduino.h>',`#include <cstdint>\n#include <cassert>\n#include <cmath>\nusing std::isfinite;\nint yields=0; void delay(int) { ++yields; }\nstruct SerialType { void begin(int) {} } Serial;`);
  runNative(src+`\nint main() { setup(); bound=3; loop(); assert(bound==6 && runs==3 && yields==3); bound=-4; loop(); assert(runs==3 && yields==3); assert(codelabRepeatCount(2.9)==2); assert(codelabRepeatCount(INFINITY)==0); }\n`);w.dispose();
});

test('random includes both signed extremes, swapped bounds and rejection sampling',()=>{
  const w=new Blockly.Workspace();w.newBlock('math_random_int');const code=generateArduino(w).code;
  const helper=code.match(/int32_t codelabRandom\([\s\S]*?\n\}/)?.[0];assert.ok(helper);
  runNative(`#include <cstdint>\n#include <cassert>\n#include <vector>\nstd::vector<uint32_t> samples; size_t pos=0;\nlong random(long n) { assert(n==65536); uint32_t s=samples.at(pos/2); return (pos++ % 2)==0 ? s>>16 : s&65535; }\n${helper}\nint main() {
    samples={0,1,0xffffffff,0x7fffffff,0x80000000,0xffffffff,3};
    assert(codelabRandom(INT32_MAX,INT32_MAX)==INT32_MAX);
    assert(codelabRandom(INT32_MAX-1,INT32_MAX)==INT32_MAX);
    assert(codelabRandom(INT32_MIN,INT32_MAX)==INT32_MAX);
    assert(codelabRandom(INT32_MIN,INT32_MAX)==-1);
    assert(codelabRandom(INT32_MAX,INT32_MIN)==0);
    assert(codelabRandom(1,10)==4); assert(pos==14);
  }`);w.dispose();
});

test('modulo zero reports a static diagnostic and handles dynamic zero at runtime',()=>{
  const w=new Blockly.Workspace(),mod=w.newBlock('math_modulo');mod.getInput('DIVIDEND').connection.connect(number(w,7).outputConnection);mod.getInput('DIVISOR').connection.connect(number(w,0).outputConnection);
  const out=generateArduino(w);assert.ok(out.warnings.some(x=>x.includes('chia dư cho 0')));
  const helper=out.code.match(/double codelabModulo\([^\n]*/)?.[0];assert.ok(helper);
  runNative(`#include <cassert>\n#include <cmath>\nint warnings=0; struct SerialType { void println(const char*) { ++warnings; } } Serial;\n${helper}\nint main() { assert(codelabModulo(7,0)==0); assert(codelabModulo(5,0)==0); assert(warnings==1); assert(codelabModulo(7,3)==1); }`);
  mod.getInputTargetBlock('DIVISOR').dispose();const v=w.getVariableMap().createVariable('soChia'),get=w.newBlock('variables_get');get.setFieldValue(v.getId(),'VAR');mod.getInput('DIVISOR').connection.connect(get.outputConnection);assert.deepEqual(generateArduino(w).warnings,[]);w.dispose();
});
test('repeat temporary names do not shadow student variables',()=>{
  const w=new Blockly.Workspace(),v=w.getVariableMap().createVariable('__codelab_repeat_limit_0'),repeat=w.newBlock('controls_repeat_ext'),get=w.newBlock('variables_get');
  get.setFieldValue(v.getId(),'VAR');repeat.getInput('TIMES').connection.connect(get.outputConnection);
  const out=generateArduino(w);assert.deepEqual(out.warnings,[]);assert.match(out.code,/codelabRepeatCount\(__codelab_repeat_limit_0\)/);assert.doesNotMatch(out.code,/const uint32_t __codelab_repeat_limit_0 =/);w.dispose();
});
