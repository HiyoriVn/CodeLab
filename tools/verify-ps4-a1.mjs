// Compile-only via the real CodeLab HTTP bridge. Never upload or list ports.
import { createBridge } from './arduino-bridge.mjs';
import { once } from 'node:events';
import { writeFile, readFile } from 'node:fs/promises';
import { ps4Workspace } from '../tests/ps4-workspace.mjs';
import { generateArduino } from '../src/generators/arduino.js';
const w=ps4Workspace();const generated=generateArduino(w,'steam-mainboard-v2');w.dispose();
if(generated.warnings.length) throw new Error(generated.warnings.join('\n'));
if(generated.code!==await readFile('tests/fixtures/ps4_uart.ino','utf8'))throw new Error('Golden sketch mismatch');
const server=createBridge();server.listen(0,'127.0.0.1');await once(server,'listening');
let failed=false;
try {
 const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(generated)});
 const result=await res.json();
 await writeFile('docs/verification/ps4_a1_compile.log',`Generated Blockly UART sketch -> CodeLab HTTP bridge -> Arduino CLI/Core3.3.7\nHTTP ${res.status}\n`+JSON.stringify(result,null,2)+'\n');
 if(!res.ok||!result.binaryBytes)throw new Error(JSON.stringify(result));
 console.log('PASS',result.fqbn,result.binaryBytes,result.output);
} catch(error){failed=true;console.error(error);} finally {await new Promise(resolve=>server.close(resolve));}
if(failed)process.exitCode=1;
