import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
test('single-motor gate, safe duty, stop, fault and reconnect on M3/M4',()=>{
 const dir=mkdtempSync(join(tmpdir(),'codelab-motor-'));
 try { const exe=join(dir,'test.exe');execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror','-I'+resolve('firmware/libraries/CodeLabRobot/src'),'-I'+resolve('firmware/demos/newmania_ps4_motor_candidate'),resolve('tests/real-motor-candidate-native.cpp'),'-o',exe]);execFileSync(exe); }
 finally {rmSync(dir,{recursive:true,force:true});}
});

test('M1 and M2 cannot instantiate the hardware backend',()=>{
 const dir=mkdtempSync(join(tmpdir(),'codelab-motor-block-'));
 try { for(const channel of [1,2]) {const file=join(dir,'bad.cpp');writeFileSync(file,`#include "SingleMotor.h"\ncodelab::motor_test::SingleMotor<${channel}>* p;\nint main(){return sizeof(*p);}`);const result=spawnSync(process.env.CXX||'g++',['-std=c++17','-I'+resolve('firmware/libraries/CodeLabRobot/src'),'-I'+resolve('firmware/demos/newmania_ps4_motor_candidate'),'-fsyntax-only',file],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/M1\/M2 are blocked by OPI/);}}
 finally {rmSync(dir,{recursive:true,force:true});}
});
test('ESP32 PWM adapter only touches selected pins and drives low on failures',()=>{
 const dir=mkdtempSync(join(tmpdir(),'codelab-pwm-'));
 try {
  writeFileSync(join(dir,'Arduino.h'),`#pragma once\n#include <cstdint>\n#define LOW 0\n#define OUTPUT 1\nvoid digitalWrite(uint8_t,int); void pinMode(uint8_t,int); bool ledcAttach(uint8_t,uint32_t,uint8_t); bool ledcWrite(uint8_t,uint32_t); bool ledcDetach(uint8_t);\n`);
  writeFileSync(join(dir,'test.cpp'),`#include <cassert>\n#include <vector>\n#include <utility>\n#include "Esp32Pwm.h"\nstd::vector<std::pair<int,int>> writes; int failAttach=0,failWrite=0;\nvoid digitalWrite(uint8_t pin,int x) { assert(pin>=39&&pin<=42); writes.push_back({pin,x}); }\nvoid pinMode(uint8_t pin,int x) { assert(pin>=39&&pin<=42&&x==OUTPUT); }\nbool ledcAttach(uint8_t pin,uint32_t hz,uint8_t bits) { assert(pin>=39&&pin<=42&&hz==5000&&bits==8);return pin!=failAttach; }\nbool ledcWrite(uint8_t pin,uint32_t val) { assert(pin>=39&&pin<=42&&val<=38);writes.push_back({pin,int(val)});return pin!=failWrite; }\nbool ledcDetach(uint8_t pin) { assert(pin>=39&&pin<=42);return true; }\nint main() { Esp32Pwm bad; assert(!bad.begin(35,36));assert(writes.empty()); Esp32Pwm io; assert(io.begin(39,40));assert(io.apply(20,0));assert(io.apply(0,20));assert(!io.apply(20,20));io.emergencyLow();assert(writes[writes.size()-1]==std::make_pair(40,0));assert(writes[writes.size()-2]==std::make_pair(39,0)); failAttach=42;Esp32Pwm failed;assert(!failed.begin(41,42));assert(writes[writes.size()-1]==std::make_pair(42,0)); }`);
  const exe=join(dir,'test.exe');execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror','-I'+dir,'-I'+resolve('firmware/libraries/CodeLabRobot/src'),'-I'+resolve('firmware/demos/newmania_ps4_motor_candidate'),join(dir,'test.cpp'),'-o',exe]);execFileSync(exe);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('MCPWM sample timers and both generators receive bounded duties and low stop',()=>{
 const dir=mkdtempSync(join(tmpdir(),'codelab-mcpwm-'));
 try {
  const driver=join(dir,'driver');mkdirSync(driver);
  writeFileSync(join(dir,'Arduino.h'),`#pragma once\n#include <cstdint>\n#define LOW 0\n#define OUTPUT 1\nvoid digitalWrite(uint8_t,int); void pinMode(uint8_t,int);\n`);
  writeFileSync(join(driver,'gpio.h'),`#pragma once\ntypedef int gpio_num_t;\nint gpio_reset_pin(gpio_num_t);\n`);
  writeFileSync(join(driver,'mcpwm.h'),`#pragma once\n#include <cstdint>\ntypedef int mcpwm_unit_t;typedef int mcpwm_timer_t;typedef int mcpwm_generator_t;typedef int mcpwm_io_signals_t;\nconstexpr int ESP_OK=0,MCPWM_UNIT_0=0,MCPWM_UNIT_1=1,MCPWM_TIMER_0=0,MCPWM_TIMER_2=2,MCPWM0A=0,MCPWM0B=1,MCPWM2A=4,MCPWM2B=5,MCPWM_OPR_A=0,MCPWM_OPR_B=1,MCPWM_UP_COUNTER=0,MCPWM_DUTY_MODE_0=0;\nstruct mcpwm_config_t {uint32_t frequency;float cmpr_a,cmpr_b;int counter_mode,duty_mode;};\nint mcpwm_gpio_init(int,int,int);int mcpwm_init(int,int,const mcpwm_config_t*);int mcpwm_set_duty(int,int,int,float);int mcpwm_set_signal_low(int,int,int);int mcpwm_set_duty_type(int,int,int,int);int mcpwm_stop(int,int);\n`);
  writeFileSync(join(dir,'test.cpp'),`#include <cassert>\n#include <cmath>\n#include <vector>\n#include "Esp32Mcpwm.h"\nint unit=-1,timer=-1,initCount=0;bool fail=false;float duty[2]={};bool running[2]={};std::vector<int> pins;\nvoid digitalWrite(uint8_t p,int x) {assert(p>=39&&p<=42&&x==LOW);} void pinMode(uint8_t p,int x){assert(p>=39&&p<=42&&x==OUTPUT);} int gpio_reset_pin(int p){assert(p>=39&&p<=42);pins.push_back(p);return 0;}\nint mcpwm_gpio_init(int u,int s,int p){assert((u==0&&((s==4&&p==39)||(s==5&&p==40)))||(u==1&&((s==0&&p==41)||(s==1&&p==42))));return 0;}\nint mcpwm_init(int u,int t,const mcpwm_config_t*c){unit=u;timer=t;initCount++;assert(c->frequency==1000&&c->cmpr_a==0&&c->cmpr_b==0);return 0;}\nint mcpwm_set_duty(int u,int t,int op,float d){assert(u==unit&&t==timer&&d>=0&&d<=50);duty[op]=d;return fail?-1:0;}\nint mcpwm_set_signal_low(int u,int t,int op){assert(u==unit&&t==timer);running[op]=false;return 0;}\nint mcpwm_set_duty_type(int u,int t,int op,int mode){assert(u==unit&&t==timer&&mode==0);running[op]=true;return 0;}\nint mcpwm_stop(int u,int t){assert(u==unit&&t==timer);return 0;}\nint main(){for(int ch=3;ch<=4;++ch){Esp32Mcpwm io;int a=ch==3?39:41,b=a+1;assert(io.begin(a,b));assert(unit==(ch==3?0:1)&&timer==(ch==3?2:0));int before=initCount;assert(io.begin(a,b)&&initCount==before);assert(io.apply(127,0));assert(running[0]&&!running[1]&&std::fabs(duty[0]-49.80392)<0.001);assert(io.apply(0,30));assert(!running[0]&&running[1]);assert(io.apply(0,0));assert(!running[0]&&!running[1]&&duty[0]==0&&duty[1]==0);assert(!io.apply(128,0));fail=true;assert(!io.apply(1,0));fail=false;io.emergencyLow();assert(pins[pins.size()-2]==a&&pins.back()==b);} Esp32Mcpwm blocked;assert(!blocked.begin(35,36));}\n`);
  const exe=join(dir,'test.exe');execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror','-I'+dir,'-I'+resolve('firmware/libraries/CodeLabRobot/src'),'-I'+resolve('firmware/demos/newmania_ps4_motor_candidate'),join(dir,'test.cpp'),'-o',exe]);execFileSync(exe);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

