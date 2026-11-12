import { useEffect, useRef, useState } from 'react';
import { useDeviceOperation } from '../device/useDeviceOperation.js';
import { FAST4WD_BOARD_ID } from '../boards/profiles.js';
import { validatePackage, sha256 } from '../device/firmware-package.js';
import { flashPackage } from '../device/browser-flash.js';
export default function BrowserFlasher({boardId,operation}) {
  const [segments,setSegments]=useState(null), [message,setMessage]=useState('Chọn manifest JSON và đủ 4 tệp .bin từ cùng một bản build.'), [confirmed,setConfirmed]=useState(false);
  const localOperation=useDeviceOperation();
  const deviceOperation=operation??localOperation, busy=deviceOperation.busy;
  const revision=useRef(0);
  useEffect(()=>()=>{++revision.current;},[]);
  const supported=window.isSecureContext && !!navigator.serial;
  const pick=async event=>{
    if(deviceOperation.isBusy())return;
    const generation=++revision.current; setSegments(null);setConfirmed(false);
    try { const files=Array.from(event.target.files); const json=files.filter(f=>f.name.endsWith('.json')); if(json.length!==1) throw new Error('Chọn đúng một manifest JSON.');
      const data=await validatePackage(JSON.parse(await json[0].text()),files,sha256);
      if(generation!==revision.current)return;
      setSegments(data);setMessage(data.map(s=>'0x'+s.address.toString(16)+' · '+s.data.length+' byte').join('\n'));
    } catch(e) {if(generation===revision.current)setMessage(e.message);}
  };
  const flash=async()=>{
    if(deviceOperation.isBusy()||!segments||!confirmed||boardId!==FAST4WD_BOARD_ID)return;
    if(!window.confirm('Ghi firmware Newmania ESP32-S3? Thay chương trình, bootloader và metadata OTA. Chỉ tiếp tục nếu bo đã dùng đúng default_8MB, nguồn động cơ đã ngắt.'))return;
    const release=deviceOperation.acquire(); if(!release)return;
    const log=text=>setMessage(m=>(m+'\n'+text).slice(-6000));
    try { const port=await navigator.serial.requestPort(); await flashPackage(port,segments,log,(_,written,total)=>setMessage('Đang nạp '+Math.round(written/total*100)+'%')); }
    catch(e){log(e.name==='NotFoundError'?'Đã hủy chọn USB.':'Nạp thất bại: '+e.message);}
    finally{release();setConfirmed(false);}
  };
  return <section aria-label="Nạp firmware từ trình duyệt"><h3>Nạp tệp .bin qua USB</h3>
    <p>Chọn gói firmware đã biên dịch sẵn. Gói này thay chương trình trên bo và độc lập với các block đang mở. Để nạp chương trình từ block, hãy dùng mục Biên dịch trên CodeLab chạy tại localhost.</p>
    {!supported && <p role="alert">Cần Chrome/Edge trên máy tính và HTTPS hoặc localhost để dùng Web Serial.</p>}
    <input aria-label="Gói firmware đã biên dịch" type="file" multiple accept=".json,.bin" disabled={busy||boardId!==FAST4WD_BOARD_ID} onChange={pick}/>
    <pre role="status" style={{whiteSpace:'pre-wrap',maxHeight:200,overflow:'auto'}}>{message}</pre>
    <label><input type="checkbox" disabled={busy||!segments} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Tôi xác nhận đúng Newmania, layout default_8MB hiện có và nguồn động cơ đã ngắt. Đã đóng Serial Monitor.</label>
    <p><button className="button button-primary" disabled={busy||!supported||!segments||!confirmed||boardId!==FAST4WD_BOARD_ID} onClick={flash}>Chọn USB và nạp…</button></p>
    <small>Không xóa toàn bộ flash. Ghi bootloader, bảng phân vùng, metadata OTA và app0; giữ vùng NVS/filesystem nếu layout hiện có trùng khớp. Không tự reset chạy robot sau nạp.</small>
  </section>;
}
