import { useEffect, useRef, useState } from 'react';
import { useDeviceOperation } from '../device/useDeviceOperation.js';
import { FAST4WD_BOARD_ID } from '../boards/profiles.js';
import { validatePackage, sha256 } from '../device/firmware-package.js';
import { flashPackage } from '../device/browser-flash.js';
export default function BrowserFlasher({boardId,operation}) {
  const [segments,setSegments]=useState(null), [message,setMessage]=useState('Chọn manifest JSON và đủ 4 tệp .bin từ cùng một bản build.');
  const [progress,setProgress]=useState(null);
  const localOperation=useDeviceOperation();
  const deviceOperation=operation??localOperation, busy=deviceOperation.busy;
  const revision=useRef(0);
  useEffect(()=>()=>{++revision.current;},[]);
  const supported=window.isSecureContext && !!navigator.serial;
  const pick=async event=>{
    if(deviceOperation.isBusy())return;
    const generation=++revision.current; setSegments(null);setProgress(null);
    try { const files=Array.from(event.target.files); const json=files.filter(f=>f.name.endsWith('.json')); if(json.length!==1) throw new Error('Chọn đúng một manifest JSON.');
      const data=await validatePackage(JSON.parse(await json[0].text()),files,sha256);
      if(generation!==revision.current)return;
      setSegments(data);setMessage(data.map(s=>'0x'+s.address.toString(16)+' · '+s.data.length+' byte').join('\n'));
    } catch(e) {if(generation===revision.current)setMessage(e.message);}
  };
  const flash=async()=>{
    if(deviceOperation.isBusy()||!supported||!segments||boardId!==FAST4WD_BOARD_ID)return;
    const release=deviceOperation.acquire(); if(!release)return;
    const log=text=>setMessage(m=>(m+'\n'+text).slice(-6000));
    setProgress(null);
    try {
      setMessage('Đang chọn USB…');
      const port=await navigator.serial.requestPort();
      if(!window.confirm('Nạp chương trình sẽ thay thế chương trình hiện tại. Hãy ngắt nguồn động cơ và đảm bảo robot ở trạng thái an toàn trước khi tiếp tục.')) {setMessage('Đã hủy nạp.');return;}
      await flashPackage(port,segments,log,(_,written,total)=>{const percent=total>0?Math.min(100,Math.round(written/total*100)):0;setProgress(percent);setMessage('Đang nạp '+percent+'%');});
    }
    catch(e){log(e.name==='NotFoundError'?'Đã hủy chọn USB.':'Nạp thất bại: '+e.message);}
    finally{release();setProgress(null);}
  };
  return <details className="device-technical" onToggle={event=>{if(busy)event.currentTarget.open=true;}}>
    <summary>Công cụ kỹ thuật</summary>
    <section aria-label="Nạp firmware từ trình duyệt"><h4>Nạp firmware có sẵn (nâng cao)</h4>
    <p>Chỉ dành cho người có chuyên môn. Gói này độc lập với chương trình Blockly đang mở.</p>
    {!supported && <p role="alert">Cần Chrome/Edge trên máy tính và HTTPS hoặc localhost để dùng Web Serial.</p>}
    <input aria-label="Gói firmware đã biên dịch" type="file" multiple accept=".json,.bin" disabled={busy||boardId!==FAST4WD_BOARD_ID} onChange={pick}/>
    <pre role="status" style={{whiteSpace:'pre-wrap',maxHeight:200,overflow:'auto'}}>{message}</pre>
    {busy && <progress aria-label="Tiến độ nạp firmware" max="100" value={progress??undefined}/>}
    <p><button className="button button-primary" disabled={busy||!supported||!segments||boardId!==FAST4WD_BOARD_ID} onClick={flash}>Chọn USB và nạp firmware có sẵn</button></p>
    <small>Không xóa toàn bộ flash. Ghi bootloader, bảng phân vùng, metadata OTA và app0; giữ vùng NVS/filesystem nếu layout hiện có trùng khớp. Không tự reset chạy robot sau nạp.</small>
  </section></details>;
}
