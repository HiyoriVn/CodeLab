import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validatePackage} from '../src/device/firmware-package.js';
import {flashPackage} from '../src/device/browser-flash.js';

const hash=d=>createHash('sha256').update(d).digest('hex');
import {fixture} from './fixtures/browser-firmware.mjs';

test('malformed manifest and short partition table fail with a package diagnostic',async()=>{
  for(const manifest of [null,{}, {version:1,segments:{length:4}}, {...fixture().manifest,segments:[null,null,null,null]}]) {
    await assert.rejects(validatePackage(manifest,fixture().files,hash), /Gói firmware không khớp/);
  }
  const f=fixture();f.data[1]=f.data[1].slice(0,64);
  f.files[1]={name:'1.bin',size:64,arrayBuffer:async()=>f.data[1].buffer};
  f.manifest.segments[1].sha256=hash(f.data[1]);
  await assert.rejects(validatePackage(f.manifest,f.files,hash), /Gói firmware không khớp/);
});

test('package checks offsets, hash, chip, profile, missing files and partition boundaries',async()=>{
 let f=fixture();assert.equal((await validatePackage(f.manifest,f.files,hash)).length,4);
 for(const mutate of [f=>f.manifest.segments[0].address=0x1000,f=>f.manifest.fqbn+='x',f=>f.files.pop(),f=>f.data[3][12]=0,f=>{f.data[1][5]=0;f.manifest.segments[1].sha256=hash(f.data[1]);},f=>f.manifest.segments[3].sha256='bad',f=>f.files.push(f.files[0])]){f=fixture();mutate(f);await assert.rejects(validatePackage(f.manifest,f.files,hash));}
});

test('disconnect failure preserves the original connection error',async()=>{
  class Transport { async disconnect(){throw Error('close failure');} }
  class ESPLoader {async main(){throw Error('initial failure');}}
  await assert.rejects(flashPackage({},[],()=>{},()=>{},async()=>({Transport,ESPLoader})), error=>{
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors.map(e=>e.message),['initial failure','close failure']);
    assert.match(error.message,/initial failure/);return true;
  });
});
test('transport gates chip, capacity and installed layout; verifies readback and closes on every outcome',async()=>{
 for(const mode of ['ok','chip','capacity','layout','unplug','write','readback']){
 const f=fixture(),segments=await validatePackage(f.manifest,f.files,hash);let closed=0,writes=0;
 class Transport{async disconnect(){closed++;}}
 class ESPLoader{constructor(){this.chip={CHIP_NAME:mode==='chip'?'ESP32':'ESP32-S3'};}async main(){if(mode==='unplug')throw Error('unplugged');}async detectFlashSize(){return mode==='capacity'?'8MB':'16MB';}async readFlash(address){const d=segments.find(s=>s.address===address).data;return mode==='layout'||mode==='readback'&&writes?new Uint8Array(d.length):d;}async writeFlash(o){writes++;assert.equal(o.eraseAll,false);assert.equal(o.flashMode,'keep');if(mode==='write')throw Error('write failure');}async after(){assert.fail('must not reset');}}
 const run=flashPackage({},segments,()=>{},()=>{},async()=>({Transport,ESPLoader}));if(mode!=='ok')await assert.rejects(run);else await run;assert.equal(closed,1);assert.equal(writes,['ok','write','readback'].includes(mode)?1:0);
 }
});
