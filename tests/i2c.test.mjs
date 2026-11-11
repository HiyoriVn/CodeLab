import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
test('I2C13 frame/sequence/freshness and actual mecanum pipeline on host',()=>{
 const dir=resolve('firmware/tests/build-output/i2c');mkdirSync(dir,{recursive:true});
 const exe=resolve(dir,'i2c.exe');
 execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',
  '-I'+resolve('firmware/libraries/CodeLabPs4I2C/src'),'-I'+resolve('firmware/libraries/CodeLabRobot/src'),
  resolve('tests/i2c-native.cpp'),'-o',exe]);
 const output=execFileSync(exe,{encoding:'utf8'});writeFileSync(resolve(dir,'simulation.log'),output);
 assert.equal((output.match(/^PASS /gm)||[]).length,4);
});
test('I2C transports reuse canonical mapping/report gate and contain no actuator outputs',()=>{
 const lf=text=>text.replaceAll('\r\n','\n');
 for(const name of ['MappingPublisher.h','ReportGate.h']) {
  assert.equal(lf(readFileSync('firmware/libraries/CodeLabPs4I2C/src/'+name,'utf8')),
   '// Derived from firmware/ps4_bridge/'+name+' by tools/i2c-demo-headers.mjs; do not edit.\n'+lf(readFileSync('firmware/ps4_bridge/'+name,'utf8')));
 }
 for(const file of ['firmware/ps4_i2c_bridge/ps4_i2c_bridge.ino','firmware/demos/newmania_ps4_i2c/newmania_ps4_i2c.ino'])
  assert.doesNotMatch(readFileSync(file,'utf8'),/pinMode\(|digitalWrite\(|gpio_set_|ledcAttach\(|ledcWrite\(|\.attach\(/);
 const slave=readFileSync('firmware/ps4_i2c_bridge/ps4_i2c_bridge.ino','utf8');
 const callback=slave.slice(slave.indexOf('void onRequest()'),slave.indexOf('void onReceive'));
 assert.doesNotMatch(callback,/publisher.update|BP32.update|ps4::getData|Serial\./);
 assert.match(callback,/portENTER_CRITICAL/);
 assert.match(slave, /dataSda\s*=\s*16\s*,\s*dataScl\s*=\s*17/);
 assert.match(readFileSync('firmware/demos/newmania_ps4_i2c/newmania_ps4_i2c.ino','utf8'),/Wire.begin\(8,9/);
});
