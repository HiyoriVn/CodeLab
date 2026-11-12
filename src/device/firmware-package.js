import { FAST4WD_BOARD_ID, getBoardProfile } from '../boards/profiles.js';
export async function validatePackage(manifest, files, digest) {
  const fail = () => { throw new Error('Gói firmware không khớp Newmania/Core 3.3.7 hoặc offsets/hash không hợp lệ.'); };
  if (!manifest || manifest.version !== 1 || manifest.boardId !== FAST4WD_BOARD_ID || manifest.fqbn !== getBoardProfile(FAST4WD_BOARD_ID).build.fqbn || manifest.core !== '3.3.7' || manifest.chip !== 'ESP32-S3' || !Array.isArray(manifest.segments) || manifest.segments.length !== 4) fail();
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
    result.push({data,address:s.address});
  }
  // Exact default_8MB layout: retain NVS and filesystem regions outside these writes.
  const expected=[[1,2,0x9000,0x5000],[1,0,0xe000,0x2000],[0,16,0x10000,0x330000],[0,17,0x340000,0x330000],[1,130,0x670000,0x180000],[1,3,0x7f0000,0x10000]];
  const p=result[1].data, view=new DataView(p.buffer,p.byteOffset,p.byteLength);
  if(p.length<224) fail();
  for(let i=0;i<expected.length;i++) { const o=i*32, e=expected[i]; if(p[o]!==0xaa||p[o+1]!==0x50||p[o+2]!==e[0]||p[o+3]!==e[1]||view.getUint32(o+4,true)!==e[2]||view.getUint32(o+8,true)!==e[3]) fail(); }
  if(p[192]!==0xeb || p[193]!==0xeb) fail();
  return result;
}
export async function sha256(data) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)), b=>b.toString(16).padStart(2,'0')).join(''); }
