import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { TYPES, NEWMANIA_MODEL, newmaniaWorkspace, designToolbox, unsupported, previewMotorTypes } from '../src/blocks/newmania.js';
import { exampleDesign, loadDesign } from '../src/design-preview/model.js';
import { generateArduino } from '../src/generators/arduino.js';
import { FAST4WD_BOARD_ID, DEFAULT_BOARD_ID } from '../src/boards/profiles.js';
import { copyToNewmaniaProgram } from '../src/ui/newmania-project.js';
import { newmaniaExample, NEWMANIA_EXAMPLES } from '../tools/newmania-examples.mjs';

const outDir=resolve('firmware/tests/build-output/newmania-integration');
mkdirSync(join(outDir,'driver'),{recursive:true});
for(const header of ['Arduino.h','Wire.h','esp_chip_info.h','esp_efuse.h','esp_efuse_table.h','driver/gpio.h','driver/mcpwm.h'])writeFileSync(join(outDir,header),'#include "fast4wd-platform.h"\n');
const flags=['-std=c++17','-Wall','-Wextra','-Werror','-I'+outDir,'-I'+resolve('tests/fixtures'),...['CodeLabFast4wd','CodeLabPs4I2C','CodeLabRobot'].map(lib=>'-I'+resolve('firmware/libraries',lib,'src'))];
const cxx=process.env.CXX||'g++';
function generate(w) { const out=generateArduino(w,FAST4WD_BOARD_ID);assert.deepEqual(out.warnings,[]);return out.code; }
function fileFor(name,code) {const path=join(outDir,name+'.cpp');writeFileSync(path,code);return path;}
function native(name,code,body) {
  const source=fileFor(name,code+`
#include <cassert>
static constexpr uint32_t OPTIONS = 1U << 9, SHARE = 1U << 8;
static void fresh(uint32_t buttons = 0, int16_t lx = 0, int16_t ly = 0, int16_t rx = 0) {
  clockMs += 20;
  Wire.report.connected = true; Wire.report.sequence = (Wire.report.sequence + 1) & 127;
  Wire.report.buttons = buttons;
  Wire.report.axes[0] = lx; Wire.report.axes[1] = ly; Wire.report.axes[2] = rx;
  loop();
}
static void arm() {
  fresh(); fresh(); fresh(OPTIONS);
  for (int i=0; i<20; ++i) fresh();
  assert(newmania.running());
}
static void stopped() { for (const auto& m: enabled) for(bool op:m) assert(!op); }
int main() { setup(); arm(); ${body} }
`);
  const binary=join(outDir,name+'.exe');
  execFileSync(cxx,[...flags,source,resolve('firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.cpp'),'-o',binary],{stdio:'pipe'});
  execFileSync(binary,{stdio:'pipe'});
}

test('three new examples use API, survive serialization and retain correct board',()=>{
  for(const name of ['hold','count','drive']) {
    const w=loadDesign(exampleDesign(name));
    const code=generate(w);
    assert.match(code,/#include <CodeLabNewmania.h>/);assert.match(code,/newmania.connectPs4\(\)/);
    assert.match(code,/void loop\(\) \{\s*newmania.update\(\);/);
    assert.doesNotMatch(code,/Wire.begin|GPIO|codelabLogQueue|delay\(/);
    const payload={boardId:FAST4WD_BOARD_ID,programModel:NEWMANIA_MODEL,workspace:Blockly.serialization.workspaces.save(w)};
    const reopened=new Blockly.Workspace();Blockly.serialization.workspaces.load(JSON.parse(JSON.stringify(payload)).workspace,reopened);
    assert.equal(generate(reopened),code);
    assert.equal(generateArduino(w,DEFAULT_BOARD_ID).code,'');w.dispose();reopened.dispose();
  }
});

test('hold example generated C++ drives M1, releases X to stop, and Share wins',()=>{
  const w=loadDesign(exampleDesign('hold')),code=generate(w);w.dispose();
  native('hold',code,`
    for(int i=0;i<12;++i) fresh(1);
    assert(newmania.motorPwm(Motor::M1)>19);
    for(int i=0;i<12;++i) { fresh(); } stopped();
    for(int i=0;i<12;++i) fresh(1);
    fresh(SHARE|1); stopped(); assert(!newmania.running());
  `);
});

test('counter generated C++ counts real presses once and prints through bounded API queue',()=>{
  const w=loadDesign(exampleDesign('count')),code=generate(w);w.dispose();
  native('count',code,`
    fresh(1); for(int i=0;i<20;++i) fresh(1);
    assert(student_var_0==1);
    fresh(); fresh(1); fresh(); fresh(1); fresh();
    for(int i=0;i<40;++i) fresh();
    assert(student_var_0==3);
    assert(serialOutput.find("1\\n")!=std::string::npos);
    fresh(SHARE); stopped(); fresh(); fresh(OPTIONS);
    for(int i=0;i<20;++i) fresh();
    assert(newmania.running() && student_var_0==0);
  `);
});

test('mecanum generated C++ preserves LY forward, RX sideways, LX rotation and signs',()=>{
  const w=loadDesign(exampleDesign('drive')),code=generate(w);w.dispose();
  assert.match(code,/newmania.mecanum\(newmania.axis\(Axis::LeftY\), newmania.axis\(Axis::RightX\), newmania.axis\(Axis::LeftX\)\)/);
  native('drive',code,`
    for(int i=0;i<30;++i) fresh(0,0,32767,0);
    assert(enabled[0][1] && enabled[1][1] && enabled[2][0] && enabled[3][0]);
    for(int i=0;i<30;++i) fresh(0,0,0,32767);
    assert(enabled[0][0] && enabled[1][1] && enabled[2][0] && enabled[3][1]);
    for(int i=0;i<30;++i) fresh(0,32767,0,0);
    assert(enabled[0][0] && enabled[1][1] && enabled[2][1] && enabled[3][0]);
    fresh(SHARE); stopped();
  `);
});

test('generated wait keeps safety active and canceled continuation does not resume',()=>{
  const w=loadDesign(exampleDesign('hold'));
  const loop=w.getBlocksByType(TYPES.forever)[0],condition=loop.getInputTargetBlock('DO');condition.dispose(false);
  const spin=w.newBlock(previewMotorTypes.get('robot_motor_spin')),power=w.newBlock('math_number');power.setFieldValue(20,'NUM');spin.getInput('POWER').connection.connect(power.outputConnection);
  const wait=w.newBlock('beginner_wait');wait.setFieldValue(1,'SECONDS');
  const stop=w.newBlock(previewMotorTypes.get('robot_motor_stop'));
  loop.getInput('DO').connection.connect(spin.previousConnection);spin.nextConnection.connect(wait.previousConnection);wait.nextConnection.connect(stop.previousConnection);
  const code=generate(w);assert.match(code,/return newmania.wait\(ctx, 1000UL,/);w.dispose();
  native('wait',code,`
    assert(newmania.motorPwm(Motor::M1)>19);
    fresh(SHARE); stopped(); assert(!newmania.running());
    for(int i=0;i<60;++i) { fresh(); } stopped(); assert(!newmania.running());
  `);
});

test('all unlocked toolbox entries produce valid C++ and disabled blocks refuse generation',()=>{
  const sketches=[];
  for(const category of designToolbox().contents)for(const item of category.contents??[]) {
    if(item.kind!=='block'||item.disabled||[TYPES.forever,TYPES.connect].includes(item.type))continue;
    const w=loadDesign(exampleDesign('drive')),loop=w.getBlocksByType(TYPES.forever)[0];loop.getInputTargetBlock('DO').dispose(false);
    const b=w.newBlock(item.type);if(item.extraState)b.loadExtraState(item.extraState);
    const variable=w.getVariableMap().createVariable('test');
    if(b.getField('VAR'))b.setFieldValue(variable.getId(),'VAR');
    for(const [field,value] of Object.entries(item.fields??{}))b.setFieldValue(value,field);
    if(b.outputConnection) {
      if(b.outputConnection.getCheck()?.includes('Boolean')) {const cond=w.newBlock('controls_if');loop.getInput('DO').connection.connect(cond.previousConnection);cond.getInput('IF0').connection.connect(b.outputConnection);}
      else {const message=w.newBlock('beginner_message');loop.getInput('DO').connection.connect(message.previousConnection);message.getInput('VALUE').connection.connect(b.outputConnection);}
    } else loop.getInput('DO').connection.connect(b.previousConnection);
    const code=generate(w);sketches.push(`namespace catalog_${sketches.length} {\n${code}\n}`);w.dispose();
  }
  assert.ok(sketches.length>20);
  execFileSync(cxx,[...flags,'-fsyntax-only',fileFor('catalog','#include <CodeLabNewmania.h>\n'+sketches.join('\n'))],{stdio:'pipe'});
  const w=loadDesign(exampleDesign('hold')),loop=w.getBlocksByType(TYPES.forever)[0];loop.getInputTargetBlock('DO').dispose(false);
  const unsupportedBlock=w.newBlock('controls_for');loop.getInput('DO').connection.connect(unsupportedBlock.previousConnection);
  assert.ok(unsupported.has(unsupportedBlock.type));assert.equal(generateArduino(w,FAST4WD_BOARD_ID).code,'');w.dispose();
});

test('repeat, nested if/else and numeric arithmetic compile through nonblocking continuations',()=>{
  const w=loadDesign(exampleDesign('count')),loop=w.getBlocksByType(TYPES.forever)[0],body=loop.getInputTargetBlock('DO');body.unplug();
  const repeat=w.newBlock('controls_repeat_ext'),count=w.newBlock('math_number');count.setFieldValue(3,'NUM');repeat.getInput('TIMES').connection.connect(count.outputConnection);repeat.getInput('DO').connection.connect(body.previousConnection);loop.getInput('DO').connection.connect(repeat.previousConnection);
  const code=generate(w);assert.match(code,/Board::repeatCount\(3.0\)/);
  execFileSync(cxx,[...flags,'-fsyntax-only',fileFor('nested',code)],{stdio:'pipe'});w.dispose();
});

test('confirmed copy preserves old block IDs and variables; independent events refuse conversion',()=>{
  const original=JSON.parse(readFileSync('examples/beginner/lesson_robot_mecanum/lesson_robot_mecanum.codelab.json','utf8')).project;
  // The app snapshots the opened workspace before conversion, assigning IDs
  // that compact hand-authored legacy fixtures may omit.
  const opened=new Blockly.Workspace();Blockly.serialization.workspaces.load(original.workspace,opened);
  original.workspace=Blockly.serialization.workspaces.save(opened);opened.dispose();
  const before=JSON.stringify(original),result=copyToNewmaniaProgram(original,'copy');
  assert.equal(JSON.stringify(original),before);
  assert.ok(result.project,result.issues.map(i=>i.warnings).join('\n'));
  assert.equal(result.project.programModel,NEWMANIA_MODEL);
  const oldW=new Blockly.Workspace(),newW=new Blockly.Workspace();Blockly.serialization.workspaces.load(original.workspace,oldW);Blockly.serialization.workspaces.load(result.project.workspace,newW);
  for(const b of oldW.getAllBlocks(false))assert.ok(newW.getBlockById(b.id),b.id);
  assert.deepEqual(newW.getVariableMap().getAllVariables().map(v=>v.getId()),oldW.getVariableMap().getAllVariables().map(v=>v.getId()));
  assert.match(generate(newW),/CodeLabNewmania/);oldW.dispose();newW.dispose();
  const events=JSON.parse(readFileSync('examples/beginner/lesson_robot_motor_events/lesson_robot_motor_events.codelab.json','utf8')).project;
  const eventsBefore=JSON.stringify(events),rejected=copyToNewmaniaProgram(events,'cannot-convert');
  assert.equal(rejected.project,null);assert.ok(rejected.issues.some(i=>i.type==='robot_ps4_event'));assert.equal(JSON.stringify(events),eventsBefore);
});

test('legacy generator and new model stay distinct; old Generic content is not relabeled',()=>{
  const legacy=JSON.parse(readFileSync('examples/beginner/lesson_robot_motor_events/lesson_robot_motor_events.codelab.json','utf8')).project;
  const w=new Blockly.Workspace();Blockly.serialization.workspaces.load(legacy.workspace,w);
  const out=generateArduino(w,legacy.boardId,legacy.deviceConfigs[legacy.boardId]);assert.deepEqual(out.warnings,[]);assert.match(out.code,/CodeLabFast4wd.h/);assert.doesNotMatch(out.code,/CodeLabNewmania.h/);w.dispose();
  const newW=new Blockly.Workspace();Blockly.serialization.workspaces.load(newmaniaWorkspace(),newW);assert.match(generate(newW),/CodeLabNewmania.h/);assert.equal(newW.getBlocksByType(TYPES.root).length,1);newW.dispose();
});

test('committed Newmania example files regenerate deterministically with exact preview code',()=>{
  for(const name of Object.keys(NEWMANIA_EXAMPLES)) {
    const payload=JSON.parse(readFileSync(`examples/newmania/${name}/${name}.codelab.json`,'utf8'));
    assert.deepEqual(JSON.parse(JSON.stringify(newmaniaExample(name))),payload);
    const w=new Blockly.Workspace();Blockly.serialization.workspaces.load(payload.project.workspace,w);
    assert.equal(generate(w),readFileSync(`examples/newmania/${name}/${name}.ino`,'utf8'));w.dispose();
  }
});

test('marked new-model workspace missing its root never falls back to legacy code',()=>{
  const w=new Blockly.Workspace();w.codelabProgramModel=NEWMANIA_MODEL;
  const result=generateArduino(w,FAST4WD_BOARD_ID);
  assert.equal(result.code,'');assert.ok(result.warnings.some(w=>w.includes('đúng một khối gốc')));w.dispose();
});
