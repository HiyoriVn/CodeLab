// Compile-only: runs the production WASM worker with local asset responses.
// Never opens a serial port or invokes a hardware uploader.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { inspectElf, verifyImage } from '../src/compiler/inspect-firmware.js';
import { debugMetadata } from '../src/compiler/debug-artifacts.js';
import { parseElf } from '../src/compiler/elf.js';

const output = path.resolve('firmware/tests/build-output/crash-audit/verified');
fs.mkdirSync(output, { recursive: true });
globalThis.self = globalThis;
self.location = { href: 'http://localhost/' };
globalThis.fetch = async url => {
  const filename = path.join(process.cwd(), 'public', new URL(url, self.location.href).pathname);
  try { return new Response(fs.readFileSync(filename)); }
  catch { return new Response('', { status: 404 }); }
};
let result;
self.postMessage = msg => { if (msg.type === 'progress') console.log(msg.message); else result = msg; };
await import('../src/compiler/browser-compiler.worker.js');
const reports = [];
for (const lesson of ['serial_counter', 'joystick_math']) {
  const code = fs.readFileSync(`examples/newmania/lessons/${lesson}/${lesson}.ino`, 'utf8');
  await self.onmessage({ data: { action: 'compile', code, boardId: 'newmania-fast100-4wd' } });
  if (result.type === 'error') throw Error(result.error);
  const elf = result.debug.elf, app = result.segments.find(s => s.address === 0x10000).data;
  const info = inspectElf(elf);
  assert.ok(info.constructors.some(c => c.name === '_GLOBAL__sub_I_sketch.ino'), 'Sketch constructor must survive linker GC and enter the startup table');
  assert.ok(parseElf(elf).sections.some(s => s.name === '.debug_info' && s.size), 'DWARF must be available for new sketch code');
  const image = await verifyImage(elf, app);
  const folder = path.join(output, lesson);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'app.elf'), elf);
  fs.writeFileSync(path.join(folder, 'app.bin'), app);
  fs.writeFileSync(path.join(folder, 'debug.json'), JSON.stringify(debugMetadata(result), null, 2));
  reports.push({ lesson, elfSha256: result.debug.elfSha256, appSha256: result.debug.appSha256, stats: result.stats, ...info, image });
  console.log(`${lesson}: constructor retained; image bytes, MMU mapping, entry, checksum and digest PASS`);
}
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
console.log(`Evidence: ${output}`);
