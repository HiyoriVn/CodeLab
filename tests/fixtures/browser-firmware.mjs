import {createHash} from 'node:crypto';
import {getBoardProfile,FAST4WD_BOARD_ID} from '../../src/boards/profiles.js';
const hash=d=>createHash('sha256').update(d).digest('hex');
export function fixture(){
 const data=[new Uint8Array(24),new Uint8Array(4096),new Uint8Array(8192),new Uint8Array(24)];
 for(const i of [0,3]){data[i][0]=0xe9;data[i][12]=9;}
 const entries=[[1,2,0x9000,0x5000],[1,0,0xe000,0x2000],[0,16,0x10000,0x330000],[0,17,0x340000,0x330000],[1,130,0x670000,0x180000],[1,3,0x7f0000,0x10000]];
 const view=new DataView(data[1].buffer);entries.forEach((e,i)=>{let o=i*32;data[1].set([0xaa,0x50,e[0],e[1]],o);view.setUint32(o+4,e[2],true);view.setUint32(o+8,e[3],true);});data[1].set([0xeb,0xeb],192);
 const files=data.map((d,i)=>({name:i+'.bin',size:d.length,arrayBuffer:async()=>d.buffer}));
 const manifest={version:1,boardId:FAST4WD_BOARD_ID,chip:'ESP32-S3',core:'3.3.7',fqbn:getBoardProfile(FAST4WD_BOARD_ID).build.fqbn,segments:data.map((d,i)=>({file:i+'.bin',address:[0,0x8000,0xe000,0x10000][i],sha256:hash(d)}))};return {manifest,files,data};
}