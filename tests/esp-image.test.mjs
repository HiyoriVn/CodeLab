import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { elfToImage } from '../src/compiler/esp-image.js';
import { parseElf } from '../src/compiler/elf.js';
import { verifyImage } from '../src/compiler/inspect-firmware.js';

function fixture() {
  const appdesc = new Uint8Array(256);
  new DataView(appdesc.buffer).setUint32(0, 0xabcd5432, true);
  const sections = [
    {name: '', type: 0, flags: 0, addr: 0, data: new Uint8Array()},
    {name: '.shstrtab', type: 3, flags: 0, addr: 0},
    {name: '.iram0.text', addr: 0x40374000, data: Uint8Array.of(1,2,3,4,5,6,7,8)},
    {name: '.dram0.data', addr: 0x3fc88000, data: Uint8Array.of(9,10,11,12)},
    {name: '.dram0.bss', type: 8, addr: 0x3fc88004, size: 512, data: new Uint8Array()},
    {name: '.flash.text', addr: 0x42000020, data: Uint8Array.of(13,14,15,16)},
    {name: '.flash.appdesc', addr: 0x3c010020, data: appdesc},
    {name: '.flash.rodata', addr: 0x3c010120, data: Uint8Array.of(17,18,19,20)},
  ];
  let names = '';
  for (const s of sections) {s.nameOff = names.length; names += s.name + '\0';}
  sections[1].data = new TextEncoder().encode(names);
  let offset = 52;
  for (const s of sections) {s.offset = offset; offset += s.data.length;}
  const bytes = new Uint8Array(offset + sections.length * 40), dv = new DataView(bytes.buffer);
  bytes.set([0x7f,69,76,70,1,1,1]);
  dv.setUint16(16, 2, true); dv.setUint16(18, 94, true); dv.setUint32(20, 1, true);
  dv.setUint32(24, 0x40374000, true); dv.setUint32(32, offset, true);
  dv.setUint16(40, 52, true); dv.setUint16(46, 40, true);
  dv.setUint16(48, sections.length, true); dv.setUint16(50, 1, true);
  sections.forEach((s, i) => {
    bytes.set(s.data, s.offset);
    [s.nameOff, s.type ?? 1, s.flags ?? 2, s.addr, s.offset, s.size ?? s.data.length].forEach((n,j) => dv.setUint32(offset + i*40 + j*4, n, true));
  });
  return bytes;
}

test('ESP32-S3 image preserves allocated bytes and entry, omits BSS, aligns flash, embeds exact ELF hash without mutating ELF', async () => {
  const elf = fixture(), original = elf.slice();
  const image = await elfToImage(elf);
  assert.deepEqual(elf, original);
  assert.equal(parseElf(elf).sections.find(s => s.name === '.dram0.bss').data.length, 0);
  assert.deepEqual(image.subarray(0xb0, 0xd0), new Uint8Array(createHash('sha256').update(elf).digest()));
  const verified = await verifyImage(elf, image);
  assert.equal(verified.entry, '0x40374000');
  assert.equal(verified.elfBytes, 'PASS');
  assert.ok(!verified.segments.some(s => s.addr === '0x3fc88004'));
  image[0xb0] ^= 1;
  await assert.rejects(verifyImage(elf, image), /checksum mismatch/);
});

test('ESP image refuses to overwrite an existing app descriptor digest', async () => {
  const elf = fixture(), section = parseElf(elf).sections.find(s => s.name === '.flash.appdesc');
  section.data[144] = 1;
  await assert.rejects(elfToImage(elf), /digest field must be empty/);
});
