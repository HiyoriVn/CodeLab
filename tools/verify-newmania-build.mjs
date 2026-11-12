// Compile the exact generated examples through the same endpoint as DevicePanel.
// Never enumerate serial ports or upload firmware.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { request } from 'node:http';
import * as Blockly from 'blockly';
import { generateArduino } from '../src/generators/arduino.js';
import { createBridge } from './arduino-bridge.mjs';

const version=execFileSync(process.env.ARDUINO_CLI_PATH||'arduino-cli',['version'],{encoding:'utf8',windowsHide:true});
assert.match(version,/Version:\s+1\.5\.1\b/);
console.log(version.trim());
const names=process.argv.slice(2).length?process.argv.slice(2):['hold_m1','counter_x','mecanum'];
const server=createBridge().listen(0,'127.0.0.1');
try {
  await once(server,'listening');
  for(const name of names) {
    assert.ok(['hold_m1','counter_x','mecanum'].includes(name));
    const payload=JSON.parse(await readFile(new URL(`../examples/newmania/${name}/${name}.codelab.json`,import.meta.url),'utf8'));
    const w=new Blockly.Workspace();let generated;
    try {Blockly.serialization.workspaces.load(payload.project.workspace,w);generated=generateArduino(w,payload.project.boardId,payload.project.deviceConfigs[payload.project.boardId]);}
    finally {w.dispose();}
    assert.deepEqual(generated.warnings,[]);
    assert.equal(generated.code,await readFile(new URL(`../examples/newmania/${name}/${name}.ino`,import.meta.url),'utf8'));
    const result=await new Promise((resolve,reject)=>{
      const body=JSON.stringify(generated);
      const req=request({hostname:'127.0.0.1',port:server.address().port,path:'/api/compile',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
        const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{try{resolve({status:res.statusCode,value:JSON.parse(Buffer.concat(chunks).toString())});}catch(e){reject(e);}});
      });
      req.setTimeout(420000,()=>req.destroy(Error('Compile timed out')));req.on('error',reject);req.end(body);
    });
    console.log(name,JSON.stringify(result));
    assert.equal(result.status,200);assert.ok(result.value.binaryBytes>0);
  }
} finally {await new Promise(resolve=>server.close(resolve));}
