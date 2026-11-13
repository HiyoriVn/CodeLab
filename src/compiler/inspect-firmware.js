import { parseElf, SHF_ALLOC, SHT_NOBITS } from './elf.js';

const hex = n => `0x${n.toString(16)}`;
export function elfSymbols(elf) {
  const table = elf.sections.find(s => s.type === 2);
  if (!table) return [];
  const strings = elf.sections[table.link].data;
  const view = new DataView(table.data.buffer, table.data.byteOffset, table.size);
  const symbols = [];
  for (let o = 0; o < table.size; o += 16) {
    const start = view.getUint32(o, true);
    const end = strings.indexOf(0, start);
    symbols.push({ name: new TextDecoder().decode(strings.subarray(start, end)),
      addr: view.getUint32(o + 4, true), size: view.getUint32(o + 8, true), type: view.getUint8(o + 12) & 15 });
  }
  return symbols;
}

export function inspectElf(bytes, pcs = []) {
  const elf = parseElf(bytes), symbols = elfSymbols(elf);
  const value = name => symbols.find(s => s.name === name)?.addr;
  const start = value('__init_array_start'), end = value('__init_array_end');
  const section = elf.sections.find(s => start >= s.addr && end <= s.addr + s.data.length);
  const constructors = [];
  if (section && start !== undefined && end !== undefined) {
    const view = new DataView(section.data.buffer, section.data.byteOffset, section.data.length);
    for (let addr = start; addr < end; addr += 4) {
      const target = view.getUint32(addr - section.addr, true);
      constructors.push({ addr: hex(target), name: symbols.find(s => s.type === 2 && s.addr === target)?.name });
    }
  }
  return {
    entry: hex(elf.entry), constructors,
    sections: elf.sections.filter(s => s.flags & SHF_ALLOC).map(s => ({ name: s.name, addr: hex(s.addr), size: s.size, type: s.type })),
    bss: ['_bss_start', '_bss_end'].map(name => ({ name, addr: value(name) === undefined ? null : hex(value(name)) })),
    // Symbol ranges only. Never present this as DWARF line resolution or proof
    // that a rebuilt ELF belongs to an earlier crashed device image.
    frames: pcs.map(pc => {
      const match = symbols.find(s => s.type === 2 && s.size && pc >= s.addr && pc < s.addr + s.size);
      return { pc: hex(pc), symbol: match?.name ?? null, offset: match ? pc - match.addr : null };
    }),
  };
}

export async function verifyImage(elfBytes, image, { embeddedElfHash = true } = {}) {
  const elf = parseElf(elfBytes), dv = new DataView(image.buffer, image.byteOffset, image.byteLength);
  const fail = message => { throw Error(message); };
  if (image[0] !== 0xe9 || dv.getUint16(12, true) !== 9 || dv.getUint32(4, true) !== elf.entry) fail('Image header/entry mismatch');
  let offset = 24, checksum = 0xef;
  const segments = [];
  for (let i = 0; i < image[1]; i++) {
    const addr = dv.getUint32(offset, true), size = dv.getUint32(offset + 4, true);
    offset += 8;
    if (offset + size > image.length) fail('Truncated image segment');
    if (addr >= 0x42000000 && addr < 0x44000000 || addr >= 0x3c000000 && addr < 0x3e000000) {
      if (addr % 65536 !== offset % 65536) fail('Flash MMU alignment mismatch');
    }
    const data = image.subarray(offset, offset + size);
    for (const byte of data) checksum ^= byte;
    segments.push({ addr, size, fileOffset: offset, data });
    offset += size;
  }
  const checksumOffset = offset + 15 - offset % 16;
  if (image[checksumOffset] !== checksum) fail('Image checksum mismatch');
  const hash = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer));
  const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (image[23] !== 1 || image.length !== checksumOffset + 33 || !equal(await hash(image.subarray(0, checksumOffset + 1)), image.subarray(checksumOffset + 1))) fail('Image SHA-256 mismatch');
  const elfHash = await hash(elfBytes);
  for (const section of elf.sections.filter(s => (s.flags & SHF_ALLOC) && s.type !== SHT_NOBITS && s.size)) {
    let expected = section.data.slice();
    if (embeddedElfHash && section.name === '.flash.appdesc') expected.set(elfHash, 144);
    let position = 0;
    while (position < expected.length) {
      const address = section.addr + position;
      const seg = segments.find(s => address >= s.addr && address < s.addr + s.size);
      if (!seg) fail(`Unloaded ELF section ${section.name}`);
      const count = Math.min(expected.length - position, seg.addr + seg.size - address);
      if (!equal(expected.subarray(position, position + count), seg.data.subarray(address - seg.addr, address - seg.addr + count))) fail(`ELF/image bytes differ: ${section.name}`);
      position += count;
    }
  }
  return { entry: hex(elf.entry), checksum: 'PASS', sha256: 'PASS', elfBytes: 'PASS',
    segments: segments.map(({ addr, size, fileOffset }) => ({ addr: hex(addr), size, fileOffset })) };
}
