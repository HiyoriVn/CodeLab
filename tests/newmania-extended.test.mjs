import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { TYPES, initializeDesign, designToolbox, unsupported } from '../src/blocks/newmania.js';
import { generateArduino } from '../src/generators/arduino.js';
import { FAST4WD_BOARD_ID } from '../src/boards/profiles.js';

const dir=resolve('firmware/tests/build-output/newmania-extended');
mkdirSync(join(dir,'driver'),{recursive:true});
for(const name of ['Arduino.h','Wire.h','esp_chip_info.h','esp_efuse.h','esp_efuse_table.h','driver/gpio.h','driver/mcpwm.h'])writeFileSync(join(dir,name),'#include "fast4wd-platform.h"\n');
const flags=['-std=c++17','-Wall','-Wextra','-Werror','-I'+dir,'-I'+resolve('tests/fixtures'),...['CodeLabFast4wd','CodeLabPs4I2C','CodeLabRobot'].map(lib=>'-I'+resolve('firmware/libraries',lib,'src'))];
const cxx=process.env.CXX||'g++';
function build() {
  const w=new Blockly.Workspace(),root=initializeDesign(w),connection=w.newBlock(TYPES.connect),end=w.newBlock(TYPES.forever);
  root.getInput('DO').connection.connect(connection.previousConnection);connection.nextConnection.connect(end.previousConnection);
  const num=n=>{const b=w.newBlock('math_number');b.setFieldValue(n,'NUM');return b;};
  const text=s=>{const b=w.newBlock('text');b.setFieldValue(s,'TEXT');return b;};
  const plug=(b,input,child)=>{b.getInput(input).connection.connect(child.outputConnection);return b;};
  const seq=(...blocks)=>{for(let i=0;i<blocks.length-1;++i)blocks[i].nextConnection.connect(blocks[i+1].previousConnection);return blocks[0];};
  const vars=new Map();
  const variable=name=>{if(!vars.has(name))vars.set(name,w.getVariableMap().createVariable(name).getId());return vars.get(name);};
  const get=name=>{const b=w.newBlock('variables_get');b.setFieldValue(variable(name),'VAR');return b;};
  const change=(name,n)=>{const b=w.newBlock('math_change');b.setFieldValue(variable(name),'VAR');return plug(b,'DELTA',typeof n==='number'?num(n):n);};
  const set=(name,value)=>{const b=w.newBlock('variables_set');b.setFieldValue(variable(name),'VAR');return plug(b,'VALUE',value);};
  const compare=(name,op,n)=>{const b=w.newBlock('logic_compare');b.setFieldValue(op,'OP');plug(b,'A',get(name));return plug(b,'B',num(n));};
  const flow=mode=>{const b=w.newBlock('controls_flow_statements');b.setFieldValue(mode,'FLOW');return b;};
  const ifDo=(condition,body)=>{const b=w.newBlock('controls_if');plug(b,'IF0',condition);b.getInput('DO0').connection.connect(body.previousConnection);return b;};
  const attach=first=>{connection.nextConnection.disconnect();connection.nextConnection.connect(first.previousConnection);let tail=first;while(tail.getNextBlock())tail=tail.getNextBlock();if(tail.nextConnection)tail.nextConnection.connect(end.previousConnection);};
  return {w,root,connection,end,num,text,plug,seq,variable,get,change,set,compare,flow,ifDo,attach};
}
function output(w) {const r=generateArduino(w,FAST4WD_BOARD_ID);assert.deepEqual(r.warnings,[]);return r.code;}
function execute(name,code,assertions,before='') {
  const source=join(dir,name+'.cpp'),binary=join(dir,name+'.exe');
  writeFileSync(source,code+`
#include <cassert>
static void fresh(uint32_t buttons=0) {
  clockMs+=20; Wire.report.connected=true; Wire.report.sequence=(Wire.report.sequence+1)&127;
  Wire.report.buttons=buttons; loop();
}
static void stopped() { for(const auto& m:enabled) for(bool x:m) assert(!x); }
int main() { ${before} setup(); fresh(); fresh(); fresh(1U<<9);
  for(int i=0;i<20;++i) { fresh(); } assert(newmania.running());
  ${assertions}
  fresh(1U<<8); stopped(); assert(!newmania.running());
}
`);
  execFileSync(cxx,[...flags,source,resolve('firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.cpp'),'-o',binary]);
  execFileSync(binary);
}

test('exactly 14 software entries unlock; three system LED entries stay locked with reasons',()=>{
  const entries=designToolbox().contents.flatMap(c=>c.contents).filter(e=>e.kind==='block');
  assert.equal(entries.length,48);assert.equal(entries.filter(e=>e.disabled).length,3);
  assert.deepEqual([...unsupported.keys()],['beginner_led','beginner_blink']);
  for(const type of ['controls_whileUntil','controls_for','controls_flow_statements','math_modulo','math_single','math_random_int','math_round','math_constrain','text_join','text_print','beginner_serial_ready','codelab_serial_print','codelab_serial_available','codelab_serial_read'])assert.ok(entries.some(e=>e.type===type&&!e.disabled),type);
});

test('generated for descends, continue advances, nested repeat break resets, while/until yield',()=>{
  const b=build(),{w,num,plug,seq,change,get,flow,ifDo,compare,variable}=b;
  variable('sum');variable('down');variable('i');variable('counter');
  const outer=w.newBlock('controls_repeat_ext'),inner=w.newBlock('controls_repeat_ext');plug(outer,'TIMES',num(10));plug(inner,'TIMES',num(5));
  outer.getInput('DO').connection.connect(inner.previousConnection);inner.getInput('DO').connection.connect(seq(change('sum',1),flow('BREAK')).previousConnection);
  const down=w.newBlock('controls_for');down.setFieldValue(variable('i'),'VAR');plug(down,'FROM',num(5));plug(down,'TO',num(1));plug(down,'BY',num(2));
  down.getInput('DO').connection.connect(seq(ifDo(compare('i','EQ',3),flow('CONTINUE')),change('down',get('i'))).previousConnection);
  const whileLoop=w.newBlock('controls_whileUntil');whileLoop.setFieldValue('WHILE','MODE');plug(whileLoop,'BOOL',compare('counter','LT',3));whileLoop.getInput('DO').connection.connect(change('counter',1).previousConnection);
  const until=w.newBlock('controls_whileUntil');until.setFieldValue('UNTIL','MODE');plug(until,'BOOL',compare('counter','GTE',5));until.getInput('DO').connection.connect(change('counter',1).previousConnection);
  b.attach(seq(outer,down,whileLoop,until));const code=output(w);w.dispose();
  assert.doesNotMatch(code,/while\s*\(/);
  execute('loops',code,'for(int j=0;j<400;++j) { fresh(); } assert(student_var_0==10); assert(student_var_1==6); assert(student_var_2==-1); assert(student_var_3==5);');
});

test('unbounded student while still yields to Share and the heartbeat',()=>{
  const b=build(),loop=b.w.newBlock('controls_whileUntil'),truth=b.w.newBlock('logic_boolean');truth.setFieldValue('TRUE','BOOL');b.plug(loop,'BOOL',truth);b.attach(loop);
  const code=output(b.w);b.w.dispose();
  execute('while_stop',code,'for(int j=0;j<50;++j) { fresh(); } assert(newmania.connected()); assert(uint32_t(clockMs-newmania.heartbeatAt())<10);');
  execute('while_watchdog',code,'clockMs+=300; loop(); stopped(); assert(!newmania.running());');
});

test('Serial reads once in order; temporary text join and RAW/LN produce correct output',()=>{
  const b=build(),{w,plug,text,seq}=b;
  const read=()=>w.newBlock('codelab_serial_read');
  const print=value=>plug(w.newBlock('text_print'),'TEXT',value);
  const ready=b.ifDo(w.newBlock('beginner_serial_ready'),print(text('ready')));
  const joinText=w.newBlock('text_join');joinText.loadExtraState({itemCount:3});plug(joinText,'ADD0',read());plug(joinText,'ADD1',text('-'));plug(joinText,'ADD2',read());
  const raw=w.newBlock('codelab_serial_print');raw.setFieldValue('RAW','ENDING');plug(raw,'VALUE',joinText);
  const line=w.newBlock('codelab_serial_print');line.setFieldValue('LN','ENDING');plug(line,'VALUE',read());
  const sub=w.newBlock('math_arithmetic');sub.setFieldValue('MINUS','OP');plug(sub,'A',read());plug(sub,'B',read());
  const div=w.newBlock('math_arithmetic');div.setFieldValue('DIVIDE','OP');plug(div,'A',read());plug(div,'B',read());
  b.attach(seq(print(w.newBlock('codelab_serial_available')),ready,raw,print(text('!')),line,print(sub),print(div)));
  const code=output(w);w.dispose();
  execute('serial',code,`for(int j=0;j<50;++j) { fresh(); } assert(serialOutput=="7\\nready\\n65-66!\\n67\\n5\\n1.5\\n"); assert(newmania.serialAvailable()==0); assert(newmania.serialRead()==-1);`,
    'serialInput=std::string({char(65),char(66),char(67),char(7),char(2),char(6),char(4)}); serialInputOffset=0; serialOutput.clear();');
});

test('all unary/round variants, signed modulo and swapped constrain bounds execute correctly',()=>{
  const b=build(),{w,plug,num,set,seq}=b,statements=[];
  for(let i=0;i<13;++i)b.variable('v'+i);
  const inputs=[['ROOT',9],['ABS',-2],['NEG',3],['LN',Math.E],['LOG10',100],['EXP',0],['POW10',2]];
  for(const [op,n] of inputs){const expr=w.newBlock('math_single');expr.setFieldValue(op,'OP');plug(expr,'NUM',num(n));statements.push(set('v'+statements.length,expr));}
  for(const op of ['ROUND','ROUNDUP','ROUNDDOWN']){const expr=w.newBlock('math_round');expr.setFieldValue(op,'OP');plug(expr,'NUM',num(-1.5));statements.push(set('v'+statements.length,expr));}
  const mod=w.newBlock('math_modulo');plug(mod,'DIVIDEND',num(-7));plug(mod,'DIVISOR',num(3));statements.push(set('v10',mod));
  const clamp=w.newBlock('math_constrain');plug(clamp,'VALUE',num(5));plug(clamp,'LOW',num(10));plug(clamp,'HIGH',num(2));statements.push(set('v11',clamp));
  const random=w.newBlock('math_random_int');plug(random,'FROM',num(5));plug(random,'TO',num(5));statements.push(set('v12',random));
  b.attach(seq(...statements));const code=output(w);w.dispose();
  const expected=[3,2,-3,1,2,1,100,-2,-1,-2,-1,5,5];
  execute('math',code,'for(int j=0;j<50;++j) { fresh(); }'+expected.map((n,i)=>`assert(std::fabs(student_var_${i}-(${n}.0))<0.000001);`).join(''));
});

test('for bounds read left to right and are captured only once',()=>{
  const b=build(),{w,plug,variable,change,get}=b;variable('sum');variable('i');
  const loop=w.newBlock('controls_for');loop.setFieldValue(variable('i'),'VAR');
  for(const input of ['FROM','TO','BY'])plug(loop,input,w.newBlock('codelab_serial_read'));
  loop.getInput('DO').connection.connect(change('sum',get('i')).previousConnection);b.attach(loop);
  const code=output(w);w.dispose();execute('for_input',code,'for(int j=0;j<80;++j) { fresh(); } assert(student_var_0==6 && student_var_1==4); assert(serialInputOffset==3);','serialInput=std::string({char(1),char(3),char(1)}); serialInputOffset=0;');
});

test('division by literal zero, zero for step and flow outside a loop give diagnostics without data loss',()=>{
  for(const kind of ['modulo','for','break']) {
    const b=build();let target;
    if(kind==='modulo'){target=b.w.newBlock('math_modulo');b.plug(target,'DIVISOR',b.num(0));b.attach(b.set('x',target));}
    if(kind==='for'){target=b.w.newBlock('controls_for');b.plug(target,'BY',b.num(0));b.attach(target);}
    if(kind==='break'){target=b.flow('BREAK');b.attach(target);b.end.dispose();}
    const before=JSON.stringify(Blockly.serialization.workspaces.save(b.w)),result=generateArduino(b.w,FAST4WD_BOARD_ID);
    assert.equal(result.code,'');assert.ok(result.warnings.some(w=>w.includes(target.id)));assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(b.w)),before);b.w.dispose();
  }
});

test('bounded text, full-range random and nonblocking Serial helpers handle boundary values',()=>{
  const source=join(dir,'support.cpp'),binary=join(dir,'support.exe');
  writeFileSync(source,`#define constrain(amt, low, high) ((amt)<(low)?(low):((amt)>(high)?(high):(amt)))
#include <CodeLabNewmania.h>
using namespace codelab::newmania;
int main() {
  Board b; char maxText[128]; std::memset(maxText,'x',127); maxText[127]=0;
  assert(Math::clamp({5,10,2})==5);
  auto text=Text::from(maxText); assert(text.valid()); text.append("x"); assert(!text.valid());
  assert(!b.message(text) && b.messageDrops()==1);
  assert(std::strcmp(Text::from("n=").append(12.5).data(),"n=12.5")==0);
  ForLoop f; double v; assert(!f.begin(v,{1,5,0})); assert(!f.contains(v));
  assert(f.begin(v,{1e308,1e308,1})); f.advance(v); assert(!f.contains(v));
  for(int i=0;i<10000;++i) { auto n=b.randomInt({5,-5}); assert(n>=-5 && n<=5); (void)b.randomInt({double(INT32_MIN),double(INT32_MAX)}); }
  assert(b.modulo({3,0})==0); assert(b.modulo({3,0})==0);
  return 0;
}`);
  execFileSync(cxx,[...flags,source,resolve('firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.cpp'),'-o',binary]);execFileSync(binary);
});
