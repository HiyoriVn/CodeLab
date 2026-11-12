import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture } from './fixtures/browser-firmware.mjs';

test('packager accepts exact Core 3.3.7, rejects a version prefix and never overwrites a manifest',()=>{
  const parent=resolve('firmware/tests/build-output/browser-packager');mkdirSync(parent,{recursive:true});
  for(const core of ['3.3.7','3.3.70']){
    const folder=mkdtempSync(join(parent,'package-')),f=fixture();
    writeFileSync(join(folder,'build.options.json'),JSON.stringify({fqbn:f.manifest.fqbn,hardwareFolders:'C:/Arduino/packages/esp32/hardware/esp32/'+core}));
    writeFileSync(join(folder,'flash_args'),'--flash_mode dio --flash_freq 80m --flash_size 16MB\n'+f.manifest.segments.map(s=>'0x'+s.address.toString(16)+' '+s.file).join('\n'));
    f.data.forEach((bytes,i)=>writeFileSync(join(folder,i+'.bin'),bytes));
    const run=()=>execFileSync(process.execPath,['tools/package-browser-firmware.mjs',folder],{stdio:'pipe'});
    const path=join(folder,'codelab-flash.json');
    if(core==='3.3.70'){assert.throws(run,/Sai FQBN\/core/);assert.equal(existsSync(path),false);continue;}
    run();const before=readFileSync(path,'utf8');assert.deepEqual(JSON.parse(before),f.manifest);
    assert.throws(run,/EEXIST/);assert.equal(readFileSync(path,'utf8'),before);
  }
});
