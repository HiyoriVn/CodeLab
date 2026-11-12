import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('WASM runtime payload exactly matches canonical library source and its revision',()=>{
  const payload=JSON.parse(readFileSync('public/toolchain-337/codelab-poc-data.json','utf8'));
  const manifest=JSON.parse(readFileSync('public/toolchain-337/manifest.json','utf8'));
  for(const lib of payload.libraries)for(const file of lib.files)
    assert.equal(file.content,readFileSync(`firmware/libraries/${lib.id}/${file.path}`,'utf8').replace(/^\uFEFF/,'').replaceAll('\r\n','\n'),`${lib.id}/${file.path}`);
  const hash=createHash('sha256').update(JSON.stringify(payload.libraries)).digest('hex');
  assert.equal(manifest.libraryRevision,hash);assert.equal(payload.libraryRevision,hash);
  assert.equal(manifest.core,'3.3.7');assert.equal(manifest.boardId,'newmania-fast100-4wd');
});
