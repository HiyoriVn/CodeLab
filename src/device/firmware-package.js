import { isNewmaniaBoard, getBoardProfile } from '../boards/profiles.js';

const DEFAULT_8MB_PARTITIONS = [
  [1, 2, 0x9000, 0x5000],
  [1, 0, 0xe000, 0x2000],
  [0, 16, 0x10000, 0x330000],
  [0, 17, 0x340000, 0x330000],
  [1, 130, 0x670000, 0x180000],
  [1, 3, 0x7f0000, 0x10000],
];

export function isDefault8MbPartitionTable(p) {
  if (!p || p.length < 224) return false;
  const view = new DataView(p.buffer, p.byteOffset, p.byteLength);
  for (let i = 0; i < DEFAULT_8MB_PARTITIONS.length; i++) {
    const o = i * 32, e = DEFAULT_8MB_PARTITIONS[i];
    if (p[o] !== 0xaa || p[o + 1] !== 0x50 || p[o + 2] !== e[0] || p[o + 3] !== e[1] || view.getUint32(o + 4, true) !== e[2] || view.getUint32(o + 8, true) !== e[3]) {
      return false;
    }
  }
  return p[192] === 0xeb && p[193] === 0xeb;
}

export async function validatePackage(manifest, files, digest) {
  const fail = () => { throw new Error('Gói firmware không khớp Newmania/Core 3.3.7 hoặc offsets/hash không hợp lệ.'); };
  if (!manifest || manifest.version !== 1 || !isNewmaniaBoard(manifest.boardId) || manifest.fqbn !== getBoardProfile(manifest.boardId).build.fqbn || manifest.core !== '3.3.7' || manifest.chip !== 'ESP32-S3' || !Array.isArray(manifest.segments) || manifest.segments.length !== 4) fail();
  const profile = getBoardProfile(manifest.boardId);
  const addresses = [0, 0x8000, 0xe000, 0x10000], limits = [0x8000,0x1000,0x2000,0x330000];
  const result=[];
  for (let i=0;i<4;i++) {
    const s=manifest.segments[i];
    if (!s || typeof s.file !== 'string' || !/^[a-f0-9]{64}$/.test(s.sha256)) fail();
    const file=files.find(f=>f.name===s.file);
    if (!file || files.filter(f=>f.name===s.file).length!==1 || s.address!==addresses[i] || file.size>limits[i] || !file.size) fail();
    const data=new Uint8Array(await file.arrayBuffer());
    if (data.length !== file.size) fail();
    if (await digest(data)!==s.sha256) fail();
    if ((i===0 || i===3) && (data.length<24 || data[0]!==0xe9 || data[12]!==9 || data[13]!==0)) fail();
    if (i===0 && profile.flashMB === 8 && ((data[3] >> 4) & 0x0f) !== 3) fail();
    result.push({data,address:s.address});
  }
  // Exact default_8MB layout: retain NVS and filesystem regions outside these writes.
  if (!isDefault8MbPartitionTable(result[1].data)) fail();
  return result;
}
export async function sha256(data) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)), b=>b.toString(16).padStart(2,'0')).join(''); }
