import { sha256 } from './firmware-package.js';
export async function flashPackage(port, segments, log, progress, load = () => import('esptool-js')) {
  let transport;
  let failure;
  try {
    const { ESPLoader, Transport } = await load();
    transport = new Transport(port);
    const loader = new ESPLoader({transport, baudrate:115200, terminal:{clean(){},write:log,writeLine:log}});
    await loader.main();
    if(loader.chip?.CHIP_NAME!=='ESP32-S3') throw new Error('Sai chip: chỉ hỗ trợ ESP32-S3. Chưa ghi flash.');
    if(await loader.detectFlashSize()!=='16MB') throw new Error('Flash không phải 16 MB. Chưa ghi.');
    const table=segments.find(s=>s.address===0x8000);
    if(!table || await sha256(await loader.readFlash(0x8000,table.data.length))!==await sha256(table.data)) throw new Error('Bảng phân vùng hiện có khác gói nạp. Chưa ghi; cần quy trình riêng cho bo trống/khác layout.');
    await loader.writeFlash({fileArray:segments,flashMode:'keep',flashFreq:'keep',flashSize:'keep',eraseAll:false,compress:true,reportProgress:progress});
    for(const segment of segments) {
      if(await sha256(await loader.readFlash(segment.address,segment.data.length))!==await sha256(segment.data)) throw new Error('Kiểm tra dữ liệu sau nạp thất bại tại 0x'+segment.address.toString(16));
    }
    log('Đã ghi và đọc lại xác minh SHA-256. Đã ghi xong. Chưa chạy chương trình; ngắt nguồn an toàn trước khi bấm RESET trên bo.');
  } catch(error) {
    failure=error;
    throw error;
  } finally {
    if(transport) {
      try { await transport.disconnect(); }
      catch(error) {
        if(failure) throw new AggregateError([failure,error], failure.message+'; Không đóng được USB: '+error.message);
        throw error;
      }
    }
  }
}
