import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('actual diagnostic sketches: echo, delayed FIFO, NACK, corrupt/short RX, timeout, initialization failure and scanner', () => {
  const dir = resolve('firmware/tests/build-output/i2c-diagnostic');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'Arduino.h'), `#pragma once
#include <cstdint>
#include <cstddef>
#include <cstring>
#include <cstdio>
#include <string>
#include <vector>
#include <cstdarg>
inline uint32_t nowMs=0;
inline uint32_t millis(){return nowMs;}
inline uint32_t micros(){return nowMs*1000;}
inline void delay(uint32_t ms){nowMs+=ms;}
using portMUX_TYPE=int;
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(x) ((void)(x))
#define portEXIT_CRITICAL(x) ((void)(x))
struct SerialMock {
 std::string log;
 void begin(int){} void setDebugOutput(bool){}
 void printf(const char* fmt,...){char b[1024];va_list a;va_start(a,fmt);vsnprintf(b,sizeof(b),fmt,a);va_end(a);log+=b;}
 void println(const char* s=""){log+=s;log+='\\n';}
};
inline SerialMock Serial;
struct EspMock {const char* getChipModel(){return "HOST_MOCK";}const char* getSdkVersion(){return "HOST_MOCK";}};
inline EspMock ESP;
`);
  writeFileSync(join(dir, 'esp_arduino_version.h'), '#define ESP_ARDUINO_VERSION_MAJOR 0\n#define ESP_ARDUINO_VERSION_MINOR 0\n#define ESP_ARDUINO_VERSION_PATCH 0\n');
  writeFileSync(join(dir, 'Wire.h'), `#pragma once
#include "Arduino.h"
struct WireMock {
 bool init=true, shortRead=false, corrupt=false, dropReceive=false;
 uint8_t error=0,target=0; size_t index=0; unsigned probes=0, reads=0;
 std::vector<uint8_t> tx,rx,fifo=std::vector<uint8_t>(8,0);
 void (*receive)(int)=nullptr; void (*requested)()=nullptr;
 bool begin(int sda,int scl,uint32_t hz){return init&&sda==8&&scl==9&&hz==100000;}
 bool begin(uint8_t address,int sda,int scl,uint32_t hz){return init&&address==0x30&&sda==16&&scl==17&&hz==100000;}
 void setTimeOut(uint16_t){} uint16_t getTimeOut(){return 20;} uint32_t getClock(){return 100000;}
 void onReceive(void(*f)(int)){receive=f;} void onRequest(void(*f)()){requested=f;}
 void beginTransmission(uint8_t a){target=a;tx.clear();}
 size_t write(const uint8_t* bytes,size_t count){tx.insert(tx.end(),bytes,bytes+count);return count;}
 size_t slaveWrite(const uint8_t* bytes,size_t count){fifo.assign(bytes,bytes+count);return count;}
 uint8_t endTransmission(bool){
   if(tx.empty()) ++probes;
   if(error) return error;
   if(target!=0x30) return 2;
   if(!tx.empty()&&receive&&!dropReceive){rx=tx;index=0;receive(int(tx.size()));}
   return 0;
 }
 size_t requestFrom(uint8_t,size_t,bool){
   ++reads; rx=fifo;index=0;
   if(shortRead&&!rx.empty()) rx.pop_back();
   if(corrupt&&!rx.empty()) rx[7]^=1;
   // Model Classic ESP32's queued previous response, then prepare the next.
   if(requested){tx.clear();requested();fifo=tx;}
   return rx.size();
 }
 int available(){return int(rx.size()-index);} int read(){return available()?rx[index++]:-1;}
};
inline WireMock Wire;
`);
  const sketch = name => resolve(`firmware/diagnostics/${name}/${name}.ino`).replaceAll('\\', '/');
  writeFileSync(join(dir, 'harness.cpp'), `
#define CONFIG_IDF_TARGET_ESP32 1
#define CONFIG_IDF_TARGET_ESP32S3 1
#include <DiagnosticLog.h>
#include <cassert>
namespace slave {
#include "${sketch('i2c_echo_slave_d1')}"
}
namespace master {
#include "${sketch('i2c_echo_master_s3')}"
}
namespace scanner {
#include "${sketch('i2c_scanner_s3')}"
}
int main(){
 slave::setup(); master::setup();
 assert(slave::busReady && master::busReady);
 master::loop(); assert(Serial.log.find("APP_ACK")!=std::string::npos);
 assert(Wire.reads>=2 && slave::rxEvents==1 && slave::invalidEvents==0);
 Serial.log.clear(); Wire.error=2; master::loop();
 assert(Serial.log.find("NACK_OR_NOT_FOUND")!=std::string::npos && Serial.log.find("APP_ACK")==std::string::npos);
 Serial.log.clear(); Wire.error=5; master::loop(); assert(Serial.log.find("TIMEOUT")!=std::string::npos);
 Wire.error=0; Wire.corrupt=true; Serial.log.clear(); master::loop();
 assert(Serial.log.find("APP_TIMEOUT")!=std::string::npos);
 Wire.corrupt=false; Wire.shortRead=true; Serial.log.clear(); master::loop();
 assert(Serial.log.find("APP_TIMEOUT")!=std::string::npos);
 Wire.shortRead=false; Wire.dropReceive=true; Serial.log.clear(); master::loop();
 assert(Serial.log.find("APP_TIMEOUT")!=std::string::npos); Wire.dropReceive=false;
 // Invalid packets are drained and cannot produce a valid application response.
 Wire.rx={0xA5,1};Wire.index=0;slave::receivePacket(2);assert(slave::invalidEvents==1 && slave::response[0]==0);
 uint8_t bytes[8]; codelab::i2cdiag::request(255,bytes); bytes[7]^=1;
 Wire.rx.assign(bytes,bytes+8);Wire.index=0;slave::receivePacket(8);assert(slave::invalidEvents==2);
 for(unsigned seq: {255U,0U}){codelab::i2cdiag::request(uint8_t(seq),bytes);Wire.rx.assign(bytes,bytes+8);Wire.index=0;slave::receivePacket(8);assert(codelab::i2cdiag::matches(slave::response,8,bytes));}
 Wire.rx.assign(10,0xA5);Wire.index=0;slave::receivePacket(10);assert(!Wire.available()&&slave::invalidEvents==3);
 scanner::setup();unsigned before=Wire.probes;scanner::loop();assert(Wire.probes-before==112);
 Wire.init=false;master::setup();Serial.log.clear();unsigned reads=Wire.reads;master::loop();assert(Wire.reads==reads && Serial.log.find("INIT_FAILED")!=std::string::npos);
 puts("PASS actual diagnostic sketches with mocked Wire; no physical bus validation");
}
`);
  const binary = join(dir, 'diagnostic.exe');
  execFileSync(process.env.CXX || 'g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-I'+dir,
    '-I'+resolve('firmware/libraries/CodeLabI2CDiagnostic/src'), join(dir, 'harness.cpp'), '-o', binary]);
  const output = execFileSync(binary, { encoding: 'utf8' });
  writeFileSync(join(dir, 'host-test.log'), output);
  assert.match(output, /PASS actual diagnostic sketches/);
});

test('documented current D1 wiring matches owner-confirmed source pins', () => {
  const source = readFileSync('firmware/ps4_i2c_bridge/ps4_i2c_bridge.ino', 'utf8');
  assert.match(source, /dataSda\s*=\s*16\s*,\s*dataScl\s*=\s*17/);
  const doc = readFileSync('firmware/demos/newmania_ps4_i2c/README.md', 'utf8');
  assert.match(doc, /SDA GPIO16/); assert.match(doc, /SCL GPIO17/);
});
