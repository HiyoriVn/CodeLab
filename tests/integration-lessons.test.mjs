import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { LESSONS, lessonProject } from '../src/lessons/newmania.js';
import { generateArduino } from '../src/generators/arduino.js';
import { designToolbox } from '../src/blocks/newmania.js';
import { legacyDriveBlocks } from '../src/blocks/beginner-toolbox.js';
import { learningCode, previewCpp } from '../src/ui/learning-code.js';

const directory=resolve('firmware/tests/build-output/integration-lessons');
mkdirSync(join(directory,'driver'),{recursive:true});
for(const header of ['Arduino.h','Wire.h','esp_chip_info.h','esp_efuse.h','esp_efuse_table.h','driver/gpio.h','driver/mcpwm.h'])
  writeFileSync(join(directory,header),'#include "fast4wd-platform.h"\n');
const sources = new Map();
for (const lesson of LESSONS) test(lesson.label+' round-trips project, blocks, variables and deterministic C++',()=>{
  const project=lessonProject(lesson.id),w=new Blockly.Workspace(),restored=new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(project.workspace,w);
    const snapshot=Blockly.serialization.workspaces.save(w);
    const payload=JSON.parse(JSON.stringify({format:'codelab-project',version:1,project:{...project,workspace:snapshot}}));
    Blockly.serialization.workspaces.load(payload.project.workspace,restored);
    assert.deepEqual(Blockly.serialization.workspaces.save(restored),snapshot);
    const result=generateArduino(w,project.boardId,project.deviceConfigs[project.boardId]);
    assert.deepEqual(result.warnings,[]);
    assert.equal(result.code,generateArduino(restored,project.boardId,project.deviceConfigs[project.boardId]).code);
    assert.equal(result.boardId,project.boardId);
    assert.deepEqual(legacyDriveBlocks(snapshot),[]);
    assert.doesNotMatch(result.code,/newmania\.mecanum\(/);
    assert.match(result.code,/newmania\.update\(\)/);
    assert.doesNotMatch(learningCode(snapshot),/xem C\+\+|xem Arduino|undefined|ctx\.pc/);
    sources.set(lesson.id,result.code);
  } finally {w.dispose();restored.dispose();}
});

test('student toolbox hides macros while legacy projects retain exact blocks and generator behavior',()=>{
  assert.deepEqual(legacyDriveBlocks(designToolbox()),[]);
  const payload=JSON.parse(readFileSync('examples/newmania/mecanum/mecanum.codelab.json','utf8'));
  const w=new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(payload.project.workspace,w);
    assert.equal(w.getBlocksByType('robot_mecanum').length,1);
    const saved=Blockly.serialization.workspaces.save(w);
    assert.deepEqual(legacyDriveBlocks(saved),['robot_mecanum']);
    const output=generateArduino(w,payload.project.boardId,payload.project.deviceConfigs[payload.project.boardId]);
    assert.deepEqual(output.warnings,[]);
    assert.match(output.code,/newmania\.mecanum\(/);
    assert.match(learningCode(saved),/robot_mecanum: xem Arduino C\+\+ đầy đủ/);
  } finally {w.dispose();}
});

test('C++ presentation removes only generated comments and preserves safety and string literals',()=>{
  const source='// Newmania ESP32S3 Board — một chương trình chính, chờ không chặn.\ncase 2: { // robot_mecanum · block-3\nnewmania.update(); const char* s = "// robot_mecanum · block-3";\n';
  assert.equal(previewCpp(source),'case 2: {\nnewmania.update(); const char* s = "// robot_mecanum · block-3";\n');
});

function native(id,body) {
  const source=join(directory,id+'.cpp'), binary=join(directory,id+'.exe');
  writeFileSync(source,sources.get(id)+`
#include <cassert>
static void fresh(uint32_t buttons=0,int16_t lx=0,int16_t ly=0,int16_t rx=0) {
  clockMs+=20; Wire.report.connected=true; Wire.report.sequence=(Wire.report.sequence+1)&127;
  Wire.report.buttons=buttons; Wire.report.axes[0]=lx; Wire.report.axes[1]=ly; Wire.report.axes[2]=rx; loop();
}
static void settle(uint32_t buttons=0,int16_t lx=0,int16_t ly=0,int16_t rx=0) { for(int i=0;i<220;++i) fresh(buttons,lx,ly,rx); }
static void output(float a,float b,float c,float d) {
  const float expected[]={a,b,c,d}; for(int i=0;i<4;++i) {
    const float actual=newmania.motorPwm(static_cast<Motor>(i));
    if(std::fabs(actual-expected[i])>=1.1f) std::fprintf(stderr,"M%d expected %.2f actual %.2f at %u\\n",i+1,expected[i],actual,clockMs);
    assert(std::fabs(actual-expected[i])<1.1f);
  }
}
int main(){ setup(); fresh(); fresh(); fresh(1U<<9); settle(); assert(newmania.running()); ${body}
  fresh(1U<<8); output(0,0,0,0); assert(!newmania.running());
}
`);
  execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror','-I'+directory,'-I'+resolve('tests/fixtures'),
    ...['CodeLabFast4wd','CodeLabPs4I2C','CodeLabRobot'].map(lib=>'-I'+resolve('firmware/libraries',lib,'src')),
    source,resolve('firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.cpp'),'-o',binary],{stdio:'pipe'});
  execFileSync(binary,{stdio:'pipe'});
}

test('lesson 03 generated native code tests individual channels, release and single L1 edge',()=>{
  native('motor_test',`
    settle(1U<<13); output(50,0,0,0); settle(); output(0,0,0,0);
    settle(1U<<14); output(0,50,0,0); settle();
    settle(1U<<15); output(0,0,50,0); settle();
    settle(1U<<16); output(0,0,0,50); settle();
    settle(1U<<4); assert(student_var_0==-1); settle(1U<<4); assert(student_var_0==-1);
    settle((1U<<4)|(1U<<13)); output(-50,0,0,0); settle(); output(0,0,0,0);
    settle(1U<<4); assert(student_var_0==1);
  `);
});
test('lesson 04 generated native code matches baseline wheel positions and reversal at 30%',()=>{
  native('four_wheels',`
    settle(1U<<13); output(30,30,30,30);
    settle(1U<<14); output(-30,-30,-30,-30);
    settle(1U<<15); output(-30,30,-30,30);
    settle(1U<<16); output(30,-30,30,-30);
    settle(); output(0,0,0,0);
  `);
});
test('lesson 05 native code verifies axes, signs, deadzone, normalization and watchdog',()=>{
  native('joystick_math',`
    settle(0,0,32767,0); output(100,100,100,100);
    settle(0,32767,0,0); output(-100,100,-100,100);
    settle(0,0,0,32767); output(-100,100,100,-100);
    settle(0,1000,1000,1000); output(0,0,0,0);
    settle(0,32767,32767,32767); output(-33,100,33,33);
    clockMs+=251; loop(); output(0,0,0,0); assert(!newmania.running());
    settle(); assert(!newmania.running());
  `);
});
