import { readFile, writeFile } from 'node:fs/promises';
// Reuse repository-owned A2 mapping/report gate byte-for-byte, not the external library.
for(const name of ['MappingPublisher.h','ReportGate.h']) {
  const text=await readFile('firmware/ps4_bridge/'+name,'utf8');
  await writeFile('firmware/libraries/CodeLabPs4I2C/src/'+name,
    '// Derived from firmware/ps4_bridge/'+name+' by tools/i2c-demo-headers.mjs; do not edit.\n'+text);
}
