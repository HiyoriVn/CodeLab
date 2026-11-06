// Compile only these three lessons. No serial-port detection, upload or firmware execution.
import {createBridge} from './arduino-bridge.mjs';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import {BEGINNER_EXAMPLES,LESSON_BOARD,beginnerWorkspace} from './beginner-examples.mjs';
import {generateArduino} from '../src/generators/arduino.js';
const log=['Issue22 beginner lessons — compile only, no ports/upload'];
const server=createBridge();server.listen(0,'127.0.0.1');await once(server,'listening');
let failed=false;
try {
  for(const name of BEGINNER_EXAMPLES) {
    const w=beginnerWorkspace(name);let result;
    try {result=generateArduino(w,LESSON_BOARD);} finally {w.dispose();}
    if(result.warnings.length)throw new Error(result.warnings.join('\n'));
    if(result.code!==await readFile(`examples/beginner/${name}/${name}.ino`,'utf8'))throw new Error('Source drift: '+name);
    console.log('Compiling '+name);
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/compile`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)});
    const body=await response.json();log.push(name,'HTTP '+response.status,JSON.stringify(body,null,2));
    await writeFile('docs/verification/beginner_compile.log',log.join('\n')+'\n');
    if(!response.ok||!body.binaryBytes)throw new Error('Compile failed: '+name);
    console.log(`${name}: PASS, ${body.binaryBytes} binary bytes`);
  }
} catch(error) {failed=true;log.push(String(error));console.error(error);}
finally {await new Promise(resolve=>server.close(resolve));log.push('EXIT_CODE='+(failed?1:0));await writeFile('docs/verification/beginner_compile.log',log.join('\n')+'\n');}
if(failed)process.exitCode=1;
