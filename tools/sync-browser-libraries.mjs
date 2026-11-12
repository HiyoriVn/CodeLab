import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const payloadPath=resolve('public/toolchain-337/codelab-poc-data.json');
const manifestPath=resolve('public/toolchain-337/manifest.json');
const payload=JSON.parse(readFileSync(payloadPath,'utf8'));
for(const library of payload.libraries) {
  const directory=resolve('firmware/libraries',library.id,'src');
  library.files=readdirSync(directory).filter(name=>/\.(?:h|hpp|c|cpp)$/.test(name)).sort().map(name=>({
    path:'src/'+name,content:readFileSync(join(directory,name),'utf8').replace(/^\uFEFF/,'').replaceAll('\r\n','\n'),
  }));
}
payload.libraryRevision=createHash('sha256').update(JSON.stringify(payload.libraries)).digest('hex');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
manifest.libraryRevision=payload.libraryRevision;
writeFileSync(payloadPath,JSON.stringify(payload)+'\n');
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Browser library revision:',payload.libraryRevision);
