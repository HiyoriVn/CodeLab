import { assertGoldenEqual } from './helpers/golden.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parserHeader } from '../tools/robot-parser-header.mjs';
test('working demo command/runtime and RZ7899 plan remain fail closed',()=>{
 const dir=resolve('firmware/tests/build-output/working-demo');mkdirSync(dir,{recursive:true});
 const exe=resolve(dir,'demo.exe');
 execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror','-include','initializer_list',
  '-I'+resolve('firmware/demos/newmania_ps4_mecanum'),'-I'+resolve('firmware/libraries/CodeLabRobot/src'),
  resolve('tests/working-demo-native.cpp'),'-o',exe]);
 const out=execFileSync(exe,{encoding:'utf8'});assert.match(out,/^PASS demo:/);
 writeFileSync(resolve(dir,'simulation.log'),out);
});
test('integrated demo reuses canonical parser and never contains actuator GPIO writes',()=>{
 const root='firmware/demos/newmania_ps4_mecanum/';
 assertGoldenEqual(readFileSync(root+'GeneratedPs4Parser.h','utf8'),parserHeader());
 for(const name of ['newmania_ps4_mecanum.ino','DemoRuntime.h','DemoConfig.h','Rz7899Plan.h'])
  assert.doesNotMatch(readFileSync(root+name,'utf8'),/pinMode\(|digitalWrite\(|gpio_set_|ledcAttach\(|ledcWrite\(|\.attach\(/);
 assert.match(readFileSync(root+'newmania_ps4_mecanum.ino','utf8'),/if\(demo::uartEnabled\)/);
});
test('UART compile overrides cannot enable Octal memory GPIO35-37',()=>{
 const dir=resolve('firmware/tests/build-output/working-demo');mkdirSync(dir,{recursive:true});
 const source=resolve(dir,'pin_gate.cpp');writeFileSync(source,'#include "DemoConfig.h"\nint main(){}\n');
 for(const pin of [35,36,37]) {
  const result=spawnSync(process.env.CXX||'g++',['-std=c++17','-fsyntax-only',
   '-I'+resolve('firmware/demos/newmania_ps4_mecanum'),'-DCODELAB_DEMO_UART_RX='+pin,
   '-DCODELAB_DEMO_UART_WIRING_CONFIRMED=1',source],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/RX conflicts with memory/);
 }
});
