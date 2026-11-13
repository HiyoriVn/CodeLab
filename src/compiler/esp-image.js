import {
  EM_XTENSA,
  SHF_ALLOC,
  SHT_FINI_ARRAY,
  SHT_INIT_ARRAY,
  SHT_PREINIT_ARRAY,
  SHT_PROGBITS,
  parseElf,
} from './elf.js';

const ESP_IMAGE_MAGIC = 0xe9;
const ESP32S3_CHIP_ID = 9;
const HEADER_LEN = 24;
const SEG_HEADER_LEN = 8;
const IROM_ALIGN = 0x10000;

const FLASH_MAPS = [
  [0x42000000, 0x44000000], // IROM
  [0x3c000000, 0x3e000000], // DROM
];
const isFlashAddr = (a) => FLASH_MAPS.some(([lo, hi]) => a >= lo && a < hi);

const MEMORY_MAP = [
  [0x00000000, 0x00010000, 'PADDING'],
  [0x3c000000, 0x3d000000, 'DROM'],
  [0x3d000000, 0x3e000000, 'EXTRAM_DATA'],
  [0x600fe000, 0x60100000, 'RTC_DRAM'],
  [0x3fc88000, 0x3fd00000, 'BYTE_ACCESSIBLE'],
  [0x3fc88000, 0x403e2000, 'MEM_INTERNAL'],
  [0x3fc88000, 0x3fd00000, 'DRAM'],
  [0x40000000, 0x4001a100, 'IROM_MASK'],
  [0x40370000, 0x403e0000, 'IRAM'],
  [0x600fe000, 0x60100000, 'RTC_IRAM'],
  [0x42000000, 0x42800000, 'IROM'],
  [0x50000000, 0x50002000, 'RTC_DATA'],
];
const memoryType = (addr) =>
  MEMORY_MAP.filter(([lo, hi]) => addr >= lo && addr < hi).map(([, , t]) => t).join(',');

const MODE = { qio: 0, qout: 1, dio: 2, dout: 3 };
const FREQ = { '40m': 0x0, '26m': 0x1, '20m': 0x2, '80m': 0xf };
const SIZE = { '1MB': 0, '2MB': 1, '4MB': 2, '8MB': 3, '16MB': 4, '32MB': 5 };

function pad4(data) {
  const rem = data.length % 4;
  if (rem === 0) return data;
  const out = new Uint8Array(data.length + 4 - rem);
  out.set(data);
  return out;
}

class ByteWriter {
  constructor() {
    this.buf = new Uint8Array(1 << 20);
    this.length = 0;
  }

  ensure(extra) {
    if (this.length + extra <= this.buf.length) return;
    let size = this.buf.length;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  byte(b) {
    this.ensure(1);
    this.buf[this.length++] = b;
  }

  u16(v) {
    this.ensure(2);
    this.buf[this.length++] = v & 0xff;
    this.buf[this.length++] = (v >> 8) & 0xff;
  }

  u32(v) {
    this.ensure(4);
    this.buf[this.length++] = v & 0xff;
    this.buf[this.length++] = (v >> 8) & 0xff;
    this.buf[this.length++] = (v >> 16) & 0xff;
    this.buf[this.length++] = (v >> 24) & 0xff;
  }

  bytes(b) {
    this.ensure(b.length);
    this.buf.set(b, this.length);
    this.length += b.length;
  }

  zeros(n) {
    this.ensure(n);
    this.buf.fill(0, this.length, this.length + n);
    this.length += n;
  }

  result() {
    return this.buf.slice(0, this.length);
  }
}

export async function elfToImage(elfBytes, opts = {}) {
  const elf = parseElf(elfBytes);
  if (elf.machine !== EM_XTENSA) throw new Error(`Expected Xtensa ELF (94), got ${elf.machine}`);

  const loadable = elf.sections
    .filter(
      (s) =>
        (s.flags & SHF_ALLOC) !== 0 &&
        (s.type === SHT_PROGBITS ||
          s.type === SHT_INIT_ARRAY ||
          s.type === SHT_FINI_ARRAY ||
          s.type === SHT_PREINIT_ARRAY) &&
        s.size > 0
    )
    .sort((a, b) => a.addr - b.addr);

  // Match esptool's app descriptor: the boot log can identify the exact ELF.
  // Copy first: parseElf() sections are views into the original ELF bytes.
  const appdesc = loadable.find(s => s.name === '.flash.appdesc');
  if (appdesc) {
    if (appdesc.size < 176 || new DataView(appdesc.data.buffer, appdesc.data.byteOffset).getUint32(0, true) !== 0xabcd5432) {
      throw new Error('Invalid ESP app descriptor');
    }
    appdesc.data = appdesc.data.slice();
    if (appdesc.data.subarray(144, 176).some(b => b !== 0)) throw new Error('ELF digest field must be empty');
    const copy = Uint8Array.from(elfBytes);
    appdesc.data.set(new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer)), 144);
  }

  const merged = [];
  for (const s of loadable) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.addr + last.data.length === s.addr &&
      memoryType(last.addr) === memoryType(s.addr)
    ) {
      const combined = new Uint8Array(last.data.length + s.data.length);
      combined.set(last.data);
      combined.set(s.data, last.data.length);
      last.data = combined;
    } else {
      merged.push({ addr: s.addr, data: s.data.slice() });
    }
  }

  const padded = merged.map((s) => ({ addr: s.addr, data: pad4(s.data) }));
  const flashSegs = padded.filter((s) => isFlashAddr(s.addr));
  const ramSegs = padded.filter((s) => !isFlashAddr(s.addr));

  const w = new ByteWriter();
  w.zeros(HEADER_LEN);
  let count = 0;
  let checksum = 0xef;

  const writeSegment = (seg) => {
    w.u32(seg.addr);
    w.u32(seg.data.length);
    w.bytes(seg.data);
    for (const b of seg.data) checksum ^= b;
    count++;
  };

  const alignmentNeeded = (seg) => {
    const alignPast = (seg.addr % IROM_ALIGN) - SEG_HEADER_LEN;
    let padLen = IROM_ALIGN - (w.length % IROM_ALIGN) + alignPast;
    if (padLen === 0 || padLen === IROM_ALIGN) return 0;
    padLen -= SEG_HEADER_LEN;
    if (padLen < 0) padLen += IROM_ALIGN;
    return padLen;
  };

  while (flashSegs.length > 0) {
    const seg = flashSegs[0];
    const padLen = alignmentNeeded(seg);
    if (padLen > 0) {
      if (ramSegs.length > 0 && padLen > SEG_HEADER_LEN) {
        const ram = ramSegs[0];
        const take = Math.min(padLen, ram.data.length);
        writeSegment({ addr: ram.addr, data: ram.data.subarray(0, take) });
        ram.addr += take;
        ram.data = ram.data.subarray(take);
        if (ram.data.length === 0) ramSegs.shift();
      } else {
        writeSegment({ addr: 0, data: new Uint8Array(padLen) });
      }
      continue;
    }
    const endRem = (w.length + SEG_HEADER_LEN + seg.data.length) % IROM_ALIGN;
    if (endRem < 0x24) {
      const padded = new Uint8Array(seg.data.length + (0x24 - endRem));
      padded.set(seg.data);
      seg.data = padded;
    }
    writeSegment(seg);
    flashSegs.shift();
  }
  for (const seg of ramSegs) writeSegment(seg);

  w.zeros(15 - (w.length % 16));
  w.bytes(Uint8Array.of(checksum & 0xff));

  const image = w.result();
  writeHeader(image, count, elf.entry, opts);

  if (opts.appendSha256 ?? true) {
    const copy = new Uint8Array(image.byteLength);
    copy.set(image);
    const digestBuf = await crypto.subtle.digest('SHA-256', copy.buffer);
    const digest = new Uint8Array(digestBuf);
    const out = new Uint8Array(image.length + digest.length);
    out.set(image);
    out.set(digest, image.length);
    return out;
  }
  return image;
}

function writeHeader(image, segmentCount, entry, opts) {
  const dv = new DataView(image.buffer, image.byteOffset, HEADER_LEN);
  dv.setUint8(0, ESP_IMAGE_MAGIC);
  dv.setUint8(1, segmentCount);
  dv.setUint8(2, MODE[opts.flashMode ?? 'dio']);
  dv.setUint8(3, (SIZE[opts.flashSize ?? '16MB'] << 4) | FREQ[opts.flashFreq ?? '80m']);
  dv.setUint32(4, entry, true);
  dv.setUint8(8, 0xee);
  dv.setUint16(12, ESP32S3_CHIP_ID, true);
  dv.setUint8(14, 0);
  dv.setUint16(15, opts.minChipRevFull ?? 0, true);
  dv.setUint16(17, opts.maxChipRevFull ?? 99, true);
  dv.setUint8(23, (opts.appendSha256 ?? true) ? 1 : 0);
}
