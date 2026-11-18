import { useEffect, useRef, useState } from 'react';
import { useDeviceOperation } from '../device/useDeviceOperation.js';
import { isNewmaniaBoard, V2_BOARD_ID, getBoardProfile } from '../boards/profiles.js';
import { validatePackage, sha256 } from '../device/firmware-package.js';
import { flashPackage } from '../device/browser-flash.js';
import { formatSerialError } from '../device/usb-port.js';

export default function BrowserFlasher({boardId,operation,usbPort}) {
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
  const newmaniaBoard = isNewmaniaBoard(boardId);
  const isV2 = boardId === V2_BOARD_ID;
  const expectedFlashSize = `${getBoardProfile(boardId).flashMB || 16}MB`;
  const flash=async(mode = 'normal')=>{
    if(deviceOperation.isBusy()||!supported||!segments||!newmaniaBoard)return;
    if(mode==='initialize'&&!isV2)return;
    const release=deviceOperation.acquire(); if(!release)return;
    const log=text=>setMessage(m=>(m+'\n'+text).slice(-6000));
    setProgress(null);
    try {
      setMessage(usbPort?.port ? `Đang dùng ${usbPort.portLabel}…` : 'Đang chọn USB…');
      await usbPort?.releaseForFlash?.();
      const port=usbPort ? await usbPort.selectPort() : await navigator.serial.requestPort();
      const confirmPrompt = mode === 'initialize'
        ? 'Thao tác này sẽ xóa toàn bộ firmware và dữ liệu trên Flash 8MB, bao gồm chương trình Arduino trước đó. Bạn có chắc chắn muốn khởi tạo lại mạch cho CodeLab?'
        : 'Nạp chương trình sẽ thay thế chương trình hiện tại. Hãy ngắt nguồn động cơ và đảm bảo robot ở trạng thái an toàn trước khi tiếp tục.';
      if(!window.confirm(confirmPrompt)) {setMessage(mode==='initialize'?'Đã hủy khởi tạo.':'Đã hủy nạp.');return;}
      await flashPackage(port,segments,log,(_,written,total)=>{const percent=total>0?Math.min(100,Math.round(written/total*100)):0;setProgress(percent);setMessage((mode==='initialize'?'Đang khởi tạo ':'Đang nạp ')+percent+'%');},undefined,{expectedFlashSize,mode,confirmedInitialize:mode==='initialize'});
    }
    catch(e){
      if(e.name==='NotFoundError'){log('Đã hủy chọn USB.');}
      else if(isV2&&(e.code==='PARTITION_MISMATCH'||String(e.message||'').includes('Bảng phân vùng hoặc cấu hình board trên mạch không khớp CodeLab'))){
        log('Mạch chưa có phân vùng CodeLab hoặc đã được nạp từ công cụ khác (ví dụ Arduino IDE). Flash chưa bị xóa. Hãy chọn "Khởi tạo / Ghi đè phân vùng" để khởi tạo lại mạch cho CodeLab.');
      }else{log('Nạp thất bại: '+formatSerialError(e));}
    }
    finally{release();setProgress(null);}
  };
  return <details className="device-technical" onToggle={event=>{if(busy)event.currentTarget.open=true;}}>
    <summary>Công cụ kỹ thuật</summary>
    <section aria-label="Nạp firmware từ trình duyệt"><h4>Nạp firmware có sẵn (nâng cao)</h4>
    <p>Chỉ dành cho người có chuyên môn. Gói này độc lập với chương trình Blockly đang mở.</p>
    {!supported && <p role="alert">Cần Chrome/Edge trên máy tính và HTTPS hoặc localhost để dùng Web Serial.</p>}
    <input aria-label="Gói firmware đã biên dịch" type="file" multiple accept=".json,.bin" disabled={busy||!newmaniaBoard} onChange={pick}/>
    <pre role="status" style={{whiteSpace:'pre-wrap',maxHeight:200,overflow:'auto'}}>{message}</pre>
    {busy && <progress aria-label="Tiến độ nạp firmware" max="100" value={progress??undefined}/>}
    <p className="device-actions">
      <button className="button button-primary" disabled={busy||!supported||!segments||!newmaniaBoard} onClick={()=>flash('normal')}>Chọn USB và nạp firmware có sẵn</button>
      {isV2 && <button className="button button-quiet" disabled={busy||!supported||!segments||!newmaniaBoard} onClick={()=>flash('initialize')}>Khởi tạo / Ghi đè phân vùng</button>}
    </p>
    <small>Nạp thường không xóa toàn bộ flash; giữ vùng NVS/filesystem nếu layout hiện có trùng khớp. Không tự reset chạy robot sau nạp.</small>
  </section></details>;
}
