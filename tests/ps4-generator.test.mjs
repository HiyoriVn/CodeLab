import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as Blockly from 'blockly';
import { ps4Workspace } from './ps4-workspace.mjs';
import { generateArduino } from '../src/generators/arduino.js';
test('PS4 UART golden code, escaped literals, include dedup and board reservations',()=>{
 const w=ps4Workspace();const a=generateArduino(w,'steam-mainboard-v2');assert.deepEqual(a.warnings,[]);
 assert.equal(a.code,generateArduino(w,'steam-mainboard-v2').code);
 assert.equal(a.code,readFileSync('tests/fixtures/ps4_uart.ino','utf8'));
 assert.equal((a.code.match(/#include <Wire.h>/g)||[]).length,1);
 assert.ok(a.code.includes("'\\n'") && a.code.includes("'\\r'") && a.code.includes("'\\0'"));
 assert.ok(!a.code.includes('\x00'));assert.match(a.code,/Serial1.begin\(115200, SERIAL_8N1, 7, 6\)/);
 assert.ok(generateArduino(w,'newmania-starter-v1').warnings.length);
 assert.deepEqual(generateArduino(w).warnings,[]);w.dispose();
});
test('actual generated C++ UART parser: ranges, malformed data, timeout and disconnect',()=>{
 const w=ps4Workspace();const code=generateArduino(w).code;w.dispose();
 const helper=code.slice(code.indexOf('class CodeLabPS4Adapter'),code.indexOf('CodeLabPS4Adapter codelabPs4;'));
 const cpp=String.raw`#include <cstdint>
#include <cstddef>
#include <string>
#include <cassert>
#include <cstdio>
uint32_t now=0;uint32_t millis(){return now;}
long map(long x,long a,long b,long c,long d){return (x-a)*(d-c)/(b-a)+c;}
class HardwareSerial{public:std::string q;size_t at=0;int available(){return at<q.size();}int read(){return (unsigned char)q[at++];}void feed(std::string s){q+=s;}};
struct WireMock{int requestFrom(uint8_t,uint8_t){return 0;}int available(){return 0;}int read(){return 0;}} Wire;
`+helper+String.raw`
int main(){HardwareSerial serial;CodeLabPS4Adapter adapter;adapter.beginUart(serial);
 auto feed=[&](std::string s){serial.feed(s);adapter.update();};
 auto neutral=[&](){assert(!adapter.connected());for(int i=0;i<4;i++)assert(adapter.axis(i)==0);for(int i=0;i<32;i++)assert(!adapter.button(i));};
 neutral();feed("1,-32768,32767,0,0,4294967295\n");assert(adapter.connected());assert(adapter.axis(0)==-1000&&adapter.axis(1)==1000&&adapter.axis(2)==0);assert(adapter.button(31));assert(!adapter.button(32));assert(adapter.axis(4)==0);
 now=250;assert(adapter.connected());now=251;neutral();
 feed("1,1,2,3,4,1\r\n");assert(adapter.connected());
 now=500;feed("garbage\n");now=502;neutral();
 const char* bad[]={"2,0,0,0,0,0\n","-1,0,0,0,0,0\n","1,32768,0,0,0,0\n","1,-32769,0,0,0,0\n","1,99999999999999999999,0,0,0,0\n","1,0,0,0,0,4294967296\n","1,0,0,0,0,-1\n","1,0,0,0,0,+1\n","1,0,0,0,0,1x\n","1,0,0,0,0,0,1\n","1,0,0,0,0\n","1,,0,0,0,0\n","1, 0,0,0,0,0\n","heartbeat\n","\n","\r\n","1,0\r,0,0,0,0\n"};
 for(auto line:bad){feed(line);neutral();}
 feed(std::string("1,0,0,0,0,1")+char(0)+"\n");neutral();
 feed(std::string(200,'1')+"\n");neutral();
 feed("1,100,200,");neutral();feed("300,400,1\n");assert(adapter.connected());
 feed("0,32767,-32768,1,2,4294967295\n");neutral();
 now=UINT32_MAX-100;feed("1,0,0,0,0,1\n");now=149;assert(adapter.connected());now=150;neutral();
 puts("PASS: real generated UART parser valid/partial/CRLF/overflow/NUL/timeout/wrap/disconnect");}
`;
 // The raw C++ fixture above uses escaped transport strings; convert doubled escapes once.
 const source=resolve('firmware/tests/build-output/ps4_parser.cpp'),exe=resolve('firmware/tests/build-output/ps4_parser.exe');
 mkdirSync(resolve('firmware/tests/build-output'),{recursive:true});
 writeFileSync(source,cpp.replaceAll('\\\\n','\\n').replaceAll('\\\\r','\\r'));
 execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',source,'-o',exe]);
 assert.match(execFileSync(exe,{encoding:'utf8'}),/^PASS:/);
});

test('controller read without configuration reports diagnostic instead of includes exception',()=>{
 for(const type of ['codelab_ps4_connected','codelab_ps4_axis','codelab_ps4_button']) {
  const w=new Blockly.Workspace();w.newBlock(type);const result=generateArduino(w);
  assert.ok(result.warnings.some(msg=>msg.includes('thêm khối cấu hình')));
  assert.ok(!result.warnings.some(msg=>msg.includes('Lỗi bộ sinh mã')));
  assert.match(result.code,/codelabPs4.update\(\);/);w.dispose();
 }
});
