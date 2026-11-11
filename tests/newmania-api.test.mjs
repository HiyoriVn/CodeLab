import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

test('Newmania facade uses real existing receiver, scheduler and motor backend on host',()=>{
  const dir=resolve('firmware/tests/build-output/newmania-api');
  mkdirSync(join(dir,'driver'),{recursive:true});
  for(const header of ['Arduino.h','Wire.h','esp_chip_info.h','esp_efuse.h','esp_efuse_table.h','driver/gpio.h','driver/mcpwm.h'])writeFileSync(join(dir,header),'#include "fast4wd-platform.h"\n');
  const flags=['-std=c++17','-Wall','-Wextra','-Werror','-I'+dir,'-I'+resolve('tests/fixtures'),...['CodeLabFast4wd','CodeLabPs4I2C','CodeLabRobot'].map(lib=>'-I'+resolve('firmware/libraries',lib,'src'))];
  const binary=join(dir,'newmania-api.exe');
  execFileSync(process.env.CXX||'g++',[...flags,resolve('tests/newmania-api-native.cpp'),resolve('firmware/libraries/CodeLabFast4wd/src/CodeLabV2Scheduler.cpp'),'-o',binary],{stdio:'pipe'});
  assert.match(execFileSync(binary,{encoding:'utf8'}),/PASS: boot\/ARM/);
  execFileSync(process.env.CXX||'g++',[...flags,'-fsyntax-only','-x','c++',resolve('tests/fixtures/newmania-api-example.ino')],{stdio:'pipe'});
});

test('new facade remains opt-in and production generator still uses existing runtime',()=>{
  assert.doesNotMatch(readFileSync('src/generators/arduino.js','utf8')+readFileSync('src/generators/v2-scheduler.js','utf8'),/CodeLabNewmania/);
  assert.match(readFileSync('firmware/libraries/CodeLabFast4wd/src/CodeLabNewmania.h','utf8'),/fast4wd::Robot robot_/);
});
