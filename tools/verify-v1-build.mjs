// Compile-only: no board list, port selection or upload call.
import { createBridge } from './arduino-bridge.mjs';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/robotics.js';
import { generateArduino } from '../src/generators/arduino.js';
import { getBoardProfile } from '../src/boards/profiles.js';
import { EXAMPLES } from './v1-examples.mjs';
const profile=getBoardProfile('newmania-starter-v1');
const log=[`V1 compile-only verification ${new Date().toISOString()}`,`Profile: ${profile.id}`,`FQBN: ${profile.build.fqbn}`,
  'Pipeline: version 1 project JSON -> Blockly -> generateArduino(profile) -> POST /api/compile -> pinned Arduino CLI/core -> binary',
  execFileSync(process.env.ARDUINO_CLI_PATH||'arduino-cli',['version'],{encoding:'utf8'})];
const server=createBridge();server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
let failed=false;
try {
  for(const name of EXAMPLES) {
    const dir=`firmware/newmania_v1/examples/${name}`;
    const json=JSON.parse(await readFile(`${dir}/${name}.codelab.json`,'utf8'));
    const w=new Blockly.Workspace();Blockly.serialization.workspaces.load(json.project.workspace,w);
    const generated=generateArduino(w,json.project.boardId);w.dispose();
    if(generated.warnings.length) throw new Error(generated.warnings.join('\n'));
    if(generated.code!==await readFile(`${dir}/${name}.ino`,'utf8')) throw new Error('Example source drift: '+name);
    log.push(`Example: ${name}`);console.log('Compiling '+name);
    const response=await fetch(base+'/api/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...generated,boardId:profile.id})});
    const result=await response.json();
    log.push(`HTTP ${response.status}`,JSON.stringify(result,null,2));
    await writeFile('docs/verification/newmania_v1_build.log',log.join('\n')+'\n');
    if(!response.ok || !result.binaryBytes) throw new Error('Compile failed: '+name);
    console.log(`${name}: PASS; binary=${result.binaryBytes} bytes`);
  }
} catch(error) { failed=true;log.push('FAIL: '+error.stack); }
finally {
  await new Promise(resolve=>server.close(resolve));
  log.push(`EXIT_CODE=${failed?1:0}`, 'No upload or hardware operations performed.');
  await writeFile('docs/verification/newmania_v1_build.log',log.join('\n')+'\n');
}
if(failed) process.exitCode=1;
