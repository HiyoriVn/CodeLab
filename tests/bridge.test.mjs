import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createBridge } from '../tools/arduino-bridge.mjs';
import { FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { writeFile, rm } from 'node:fs/promises';
const v1=getBoardProfile('newmania-starter-v1');

test('experimental OPI compile target is retained and old V1 cannot upload its build',async()=>{
 await withServer(async(post,calls)=>{
  const p=getBoardProfile('newmania-v1-16m-opi-experimental');
  const code='void setup() {} void loop() {}';
  const result=await post('/api/compile',{code,boardId:p.id,warnings:[]});
  assert.equal(result.status,200);assert.equal(result.body.fqbn,p.build.fqbn);
  assert.equal(calls.find(a=>a[0]==='compile')[2],p.build.fqbn);
  assert.equal((await post('/api/upload',{buildId:result.body.buildId,boardId:v1.id,code,port:'MOCK_PORT',confirmed:true})).status,409);
  assert.equal(calls.filter(a=>a[0]==='upload').length,0);
 });
});
async function withServer(action,{compileFail=false,installed='3.3.7'}={}) {
  const calls=[];const dirs=[];
  const server=createBridge({execute:async args=>{
    calls.push(args);
    if(args[0]==='core') return {ok:true,output:JSON.stringify({platforms:[{id:'esp32:esp32',installed_version:installed}]}),error:''};
    if(args[0]==='board') return {ok:true,output:JSON.stringify({detected_ports:[
      {port:{address:'MOCK_PORT',label:'Mock only'}},
      {port:{address:'COM4',protocol:'serial',properties:{vid:'0x303A',pid:'0x1001'}}},
      {port:{address:'COM8',protocol:'serial',properties:{vid:'10C4',pid:'EA60'}}},
    ]}),error:''};
    if(args[0]==='compile') {if(!compileFail) await writeFile(args[4]+'/CodeLabSketch.ino.bin','mock binary'); dirs.push(args.at(-1).replace(/[\\/]CodeLabSketch$/,''));return {ok:!compileFail,output:compileFail?'compiler detail':'compiled by test double',error:compileFail?'test error':''};}
    return {ok:true,output:'mock '+args[0],error:''};
  }});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  try { await action(post,calls); } finally { await new Promise(resolve=>server.close(resolve));for(const dir of dirs) await rm(dir,{recursive:true,force:true}); }
}
test('profile target survives compile -> explicit upload; stale targets/code/ports rejected',async()=>{
 await withServer(async(post,calls)=>{
  const code='void setup() {} void loop() {}';
  const result=await post('/api/compile',{code,boardId:v1.id,warnings:[]});
  assert.equal(result.status,200);assert.equal(result.body.fqbn,v1.build.fqbn);
  assert.equal(calls.find(a=>a[0]==='compile')[2],v1.build.fqbn);
  assert.equal(calls.filter(a=>a[0]==='upload').length,0);
  const upload={buildId:result.body.buildId,boardId:v1.id,code,port:'MOCK_PORT',confirmed:true};
  assert.equal((await post('/api/upload',{...upload,confirmed:false})).status,400);
  assert.equal((await post('/api/upload',{...upload,warnings:['GPIO conflict']})).status,409);
  assert.equal((await post('/api/upload',{...upload,code:code+' '})).status,409);
  assert.equal((await post('/api/upload',{...upload,boardId:'steam-mainboard-v2'})).status,409);
  assert.equal((await post('/api/upload',{...upload,port:'COM_FAKE'})).status,400);
  assert.equal((await post('/api/upload',upload)).status,200);
  assert.equal(calls.find(a=>a[0]==='upload')[2],v1.build.fqbn);
 });
});
test('unknown profile and generator warnings block compile; missing core fails explicitly',async()=>{
 await withServer(async(post,calls)=>{
  assert.equal((await post('/api/compile',{code:'x',boardId:'bad'})).status,400);
  assert.equal((await post('/api/compile',{code:'x',boardId:v1.id,warnings:['GPIO conflict']})).status,400);
  assert.equal(calls.length,0);
 });
 await withServer(async(post,calls)=>{
  assert.equal((await post('/api/compile',{code:'x',boardId:v1.id})).status,409);
  assert.ok(!calls.some(a=>a[0]==='compile'));
 },{installed:'3.3.6'});
});
test('compiler diagnostics retained in error response',async()=>{
 await withServer(async post=>{
  const r=await post('/api/compile',{code:'broken',boardId:v1.id});
  assert.equal(r.status,422);assert.equal(r.body.error,'test error');assert.equal(r.body.output,'compiler detail');
 },{compileFail:true});
});
test('legacy compile without boardId still selects generic',async()=>{
 await withServer(async(post,calls)=>{
  const r=await post('/api/compile',{code:'void setup() {} void loop() {}'});
  assert.equal(r.status,200);assert.equal(r.body.boardId,'generic-esp32-s3');
  assert.equal(calls.find(a=>a[0]==='compile')[2],process.env.CODELAB_FQBN||'esp32:esp32:esp32s3');
 });
});
test('fast4wd uses repository libraries and refuses D1 or unconfirmed hardware before upload', async () => {
  await withServer(async (post, calls) => {
    const board = getBoardProfile(FAST4WD_BOARD_ID);
    const code = '#include <CodeLabFast4wd.h>\nvoid setup() {} void loop() {}';
    const result = await post('/api/compile', { code, boardId: board.id, libraries: ['untrusted-browser-path'] });
    assert.equal(result.status, 200);
    assert.equal(result.body.fqbn, board.build.fqbn);
    const compile = calls.find(args => args[0] === 'compile');
    assert.equal(compile[5], '--libraries');
    assert.match(compile[6], /firmware[\\/]libraries[\\/]?$/);
    assert.ok(!compile.includes('untrusted-browser-path'));
    const upload = { code, boardId: board.id, buildId: result.body.buildId, port: 'COM4', confirmed: true, hardwareConfirmed: true };
    for (const fields of [{ confirmed: false }, { hardwareConfirmed: false }, { port: 'COM8' }, { port: 'COM12' }]) {
      assert.equal((await post('/api/upload', { ...upload, ...fields })).status, 400);
    }
    assert.equal((await post('/api/upload', { ...upload, boardId: v1.id })).status, 409);
    assert.ok(!calls.some(args => args[0] === 'upload'));
    assert.equal((await post('/api/upload', upload)).status, 200);
    assert.deepEqual(calls.find(args => args[0] === 'upload').slice(0, 5),
      ['upload', '--fqbn', board.build.fqbn, '--port', 'COM4']);
  });
});
