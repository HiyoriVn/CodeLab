import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ps4Workspace } from './ps4-workspace.mjs';
import { generateArduino } from '../src/generators/arduino.js';
test('bridge mapping/publisher golden vectors round-trip through actual A1 C++ parser',()=>{
 const w=ps4Workspace();const generated=generateArduino(w).code;w.dispose();
 const helper=generated.slice(generated.indexOf('class CodeLabPS4Adapter'),generated.indexOf('CodeLabPS4Adapter codelabPs4;'));
 const vectors=JSON.parse(readFileSync('tests/fixtures/ps4_bridge_vectors.json','utf8'));
 const golden=vectors.map(v=>`{Input input{${v.input.join(',')}};Frame frame;assert(mapInput(input,frame));assert(serialize(frame,b,sizeof(b)));assert(std::string(b)==${JSON.stringify(v.csv)});}`).join('\n');
 const cpp=String.raw`#include <cstdint>
#include <cstddef>
#include <string>
#include <cassert>
#include <cstdio>
#include "../../ps4_bridge/MappingPublisher.h"
#include "../../ps4_bridge/ReportGate.h"
using namespace codelab::ps4bridge;
uint32_t now=0;uint32_t millis(){return now;}
long map(long x,long a,long b,long c,long d){return (x-a)*(d-c)/(b-a)+c;}
class HardwareSerial{public:std::string q;size_t at=0;int available(){return at<q.size();}int read(){return (unsigned char)q[at++];}};
struct WireMock{int requestFrom(uint8_t,uint8_t){return 0;}int available(){return 0;}int read(){return 0;}} Wire;
`+helper+String.raw`
int main(){char b[96];
`+golden+String.raw`
 HardwareSerial serial;CodeLabPS4Adapter parser;parser.beginUart(serial);
 for(int p=-100;p<=100;p++){Frame f;Input in;in.lx=p;in.ly=p;assert(mapInput(in,f));assert(serialize(f,b,sizeof(b)));serial.q+=b;parser.update();assert(parser.connected());assert(parser.axis(0)==p*10&&parser.axis(1)==p*10);}
 const int source[]={0,1,2,3,4,5,6,7,10,11,8,9,12,14,15,16,17};
 for(int dest=0;dest<17;dest++){Frame f;Input in;in.buttons=1UL<<source[dest];assert(mapInput(in,f));assert(f.buttons==(1UL<<dest));assert(serialize(f,b,sizeof(b)));serial.q+=b;parser.update();for(int j=0;j<17;j++)assert(parser.button(j)==(j==dest));}
 Frame f;Input invalid;invalid.lx=101;assert(!mapInput(invalid,f));invalid.lx=-101;assert(!mapInput(invalid,f));
 Publisher publisher;Input in;in.lx=50;
 assert(publisher.update(false,false,in,0,b,sizeof(b)));assert(std::string(b)=="0,0,0,0,0,0\n");
 assert(!publisher.update(true,false,in,1,b,sizeof(b)));
 assert(publisher.update(true,true,in,10,b,sizeof(b)));now=10;serial.q+=b;parser.update();assert(parser.connected()&&parser.axis(0)==500);assert(publisher.update(true,true,in,20,b,sizeof(b)));now=20;serial.q+=b;parser.update();assert(parser.axis(0)==500);
 assert(!publisher.update(true,false,in,270,b,sizeof(b)));assert(publisher.update(true,false,in,271,b,sizeof(b)));assert(b[0]=='0');now=271;serial.q+=b;parser.update();assert(!parser.connected()&&parser.axis(0)==0);
 assert(!publisher.update(true,false,in,272,b,sizeof(b)));
 assert(publisher.update(true,true,in,300,b,sizeof(b)));assert(publisher.update(false,false,in,301,b,sizeof(b)));assert(b[0]=='0');
 assert(!publisher.update(true,false,in,302,b,sizeof(b)));
 assert(publisher.update(true,true,in,303,b,sizeof(b)));publisher.invalidate();assert(publisher.update(true,false,in,304,b,sizeof(b)));assert(b[0]=='0');
 assert(publisher.update(true,true,in,UINT32_MAX-100,b,sizeof(b)));assert(!publisher.update(true,false,in,149,b,sizeof(b)));assert(publisher.update(true,false,in,150,b,sizeof(b)));assert(b[0]=='0');
 ReportGate gate;assert(gate.allow(true));gate.resetRequested();assert(!gate.allow(true));assert(!gate.allow(false));assert(gate.allow(true));
 int reads=0;ReportGate events;auto cached=[&](){++reads;return true;};
 assert(!events.readFresh(true,false,cached));assert(reads==0);
 assert(events.readFresh(true,true,cached));assert(events.readFresh(true,true,cached));assert(reads==2);
 events.resetRequested();assert(!events.readFresh(true,true,cached));assert(reads==2);
 assert(!events.readFresh(false,false,cached));assert(events.readFresh(true,true,cached));assert(reads==3);
 puts("PASS: 201 axis values,17 buttons,Touchpad exclusion,goldens,actual parser,identical fresh,stale,disconnect,reset,reconnect,wrap");}
`;
 const dir=resolve('firmware/tests/build-output');mkdirSync(dir,{recursive:true});
 const source=resolve(dir,'ps4_bridge_test.cpp'),exe=resolve(dir,'ps4_bridge_test.exe');writeFileSync(source,cpp);
 execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',source,'-o',exe]);
 assert.match(execFileSync(exe,{encoding:'utf8'}),/^PASS:/);
});
