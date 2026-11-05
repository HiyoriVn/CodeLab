import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parserClass, parserHeader } from '../tools/robot-parser-header.mjs';

test('mecanum/controller host simulation uses real CSV publisher/parser and mock actuators',()=>{
  const directory=resolve('firmware/tests/build-output/mecanum');mkdirSync(directory,{recursive:true});
  writeFileSync(resolve(directory,'ParserUnderTest.h'),parserClass());
  const executable=resolve(directory,'mecanum.exe');
  execFileSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',
    '-I'+resolve('firmware/libraries/CodeLabRobot/src'),'-I'+resolve('firmware/ps4_bridge'),
    '-I'+directory,resolve('tests/mecanum-native.cpp'),'-o',executable]);
  const output=execFileSync(executable,{encoding:'utf8'});
  writeFileSync(resolve(directory,'simulation.log'),output);
  assert.equal((output.match(/^PASS /gm)||[]).length,5);
  assert.match(output,/SIMULATION_ONLY/);
});
test('compile-only simulation parser header matches generator; no hardware actuator initialization',()=>{
  assert.equal(readFileSync('firmware/verification/ps4_mecanum_sim/GeneratedPs4Parser.h','utf8'),parserHeader());
  const sketch=readFileSync('firmware/verification/ps4_mecanum_sim/ps4_mecanum_sim.ino','utf8');
  assert.doesNotMatch(sketch,/pinMode\(|gpio_set_|ledcAttach\(|analogWrite\(|\.attach\(|Serial1.begin\(|Wire.begin\(/);
  assert.match(sketch,/MockMotors/);assert.match(sketch,/MockServo/);
});
