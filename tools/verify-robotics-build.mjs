// Compile only: supported Blockly examples plus changed legacy golden sketches. No ports/upload.
import {createBridge} from './arduino-bridge.mjs';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import * as Blockly from 'blockly';
import {CASES} from './robotics-examples.mjs';
import {EXAMPLES} from './v1-examples.mjs';
import {generateArduino} from '../src/generators/arduino.js';
import {ps4Workspace} from '../tests/ps4-workspace.mjs';
const cases=CASES.filter(c=>c.supported).map(c=>({...c,path:`firmware/verification/robotics_examples/${c.name}/${c.name}`}));
for(const name of EXAMPLES)cases.push({name:'legacy_v1_'+name,boardId:'newmania-starter-v1',path:`firmware/newmania_v1/examples/${name}/${name}`});
cases.push({name:'ps4_uart_chain',boardId:'steam-mainboard-v2',ps4:true});
const log=['Robotics compile regression; CLI/Core pinned by CodeLab service; no upload/port selection'];
const server=createBridge();server.listen(0,'127.0.0.1');await once(server,'listening');let failed=false;
try{for(const item of cases){
 const w=item.ps4?ps4Workspace():new Blockly.Workspace();
 if(!item.ps4){const p=JSON.parse(await readFile(item.path+'.codelab.json','utf8'));Blockly.serialization.workspaces.load(p.project.workspace,w);}
 const result=generateArduino(w,item.boardId);w.dispose();
 if(result.warnings.length)throw new Error(result.warnings.join('\n'));
 const golden=await readFile(item.ps4?'tests/fixtures/ps4_uart.ino':item.path+'.ino','utf8');if(result.code!==golden)throw new Error('Source drift '+item.name);
 console.log('Compiling '+item.name);
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)});const body=await response.json();
 log.push('Example: '+item.name,'HTTP '+response.status,JSON.stringify(body,null,2));await writeFile('docs/verification/robotics_blocks_compile.log',log.join('\n')+'\n');
 if(!response.ok||!body.binaryBytes)throw new Error('Compile failed '+item.name);console.log(item.name+': PASS '+body.binaryBytes+' bytes');
}}catch(e){failed=true;log.push('FAIL: '+e.stack);console.error(e);}finally{await new Promise(resolve=>server.close(resolve));log.push('EXIT_CODE='+(failed?1:0));await writeFile('docs/verification/robotics_blocks_compile.log',log.join('\n')+'\n');}
if(failed)process.exitCode=1;
