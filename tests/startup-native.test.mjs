import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startupCode } from '../src/boards/startup.js';
import { getBoardProfile } from '../src/boards/profiles.js';
test('generated V1 startup executes LOW-before-output and fails closed without hardware',()=>{
 const dir=resolve('firmware/tests/build-output');mkdirSync(dir,{recursive:true});
 const cpp=`#include <cstdint>
#include <vector>
#include <cassert>
#include <cstdio>
using gpio_num_t=int;
constexpr int ESP_OK=0, GPIO_MODE_INPUT=1, GPIO_MODE_OUTPUT=2, GPIO_FLOATING=3;
struct E { char op; int pin; int value; };
std::vector<E> events; char fail=0;
int gpio_set_direction(int pin,int mode){events.push_back({'D',pin,mode});return (fail=='D'||(fail=='O'&&mode==GPIO_MODE_OUTPUT))?-1:0;}
int gpio_set_pull_mode(int pin,int mode){events.push_back({'P',pin,mode});return fail=='P'?-1:0;}
int gpio_set_level(int pin,int level){events.push_back({'L',pin,level});return fail=='L'?-1:0;}
${startupCode(getBoardProfile('newmania-starter-v1')).definitions}
int main(){
 const int servos[]={12,13,14,15};const int low[]={35,36,37,38,39,40,41,42,17};
 assert(codelabSafeStartup());assert(events.size()==26);
 for(int i=0;i<4;i++){assert(events[i*2].pin==servos[i]&&events[i*2].value==GPIO_MODE_INPUT);assert(events[i*2+1].op=='P'&&events[i*2+1].value==GPIO_FLOATING);}
 for(int i=0;i<9;i++){assert(events[8+i].pin==low[i]&&events[8+i].op=='L'&&events[8+i].value==0);assert(events[17+i].pin==low[i]&&events[17+i].value==GPIO_MODE_OUTPUT);}
 for(char error : {'D','P','L'}){events.clear();fail=error;assert(!codelabSafeStartup());for(auto e:events)assert(e.value!=GPIO_MODE_OUTPUT||e.op!='D');}
 events.clear();fail='O';assert(!codelabSafeStartup());assert(events.size()==26);
 puts("PASS: generated V1 safe startup operations/order/failure paths");}
`;
 const source=resolve(dir,'v1_startup.cpp'),exe=resolve(dir,process.platform==='win32'?'v1_startup.exe':'v1_startup');
 writeFileSync(source,cpp);
 execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',source,'-o',exe]);
 assert.match(execFileSync(exe,{encoding:'utf8'}),/^PASS:/);
});
