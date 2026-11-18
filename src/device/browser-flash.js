import { sha256, isDefault8MbPartitionTable } from './firmware-package.js';
import { formatSerialError } from './usb-port.js';
import { withSerialPort, stopSerialSession, isPortAlreadyClosed } from './serial-lifecycle.js';

function validateInitializeSegments(segments) {
  const fail = (msg) => { throw new Error(msg); };
  if (!Array.isArray(segments) || segments.length !== 4) fail('Gói firmware V2 không đủ 4 phân đoạn (bootloader, partitions, boot_app0, app). Chưa ghi flash.');
  const expected = [
    { address: 0x0, limit: 0x8000 },
    { address: 0x8000, limit: 0x1000 },
    { address: 0xe000, limit: 0x2000 },
    { address: 0x10000, limit: 0x330000 },
  ];
  const flashLimit = 8 * 1024 * 1024;
  for (let i = 0; i < 4; i++) {
    const seg = segments[i];
    const exp = expected[i];
    if (!seg || seg.address !== exp.address || !(seg.data instanceof Uint8Array) || !seg.data.length || seg.data.length > exp.limit || seg.address + seg.data.length > flashLimit) {
      fail('Offset hoặc kích thước phân đoạn firmware không hợp lệ cho Flash 8MB. Chưa ghi flash.');
    }
  }
  const boot = segments[0].data;
  if (boot.length < 24 || boot[0] !== 0xe9 || boot[12] !== 9 || boot[13] !== 0 || ((boot[3] >> 4) & 0x0f) !== 3) {
    fail('Bootloader không khớp ESP32-S3 Flash 8MB. Chưa ghi flash.');
  }
  if (!isDefault8MbPartitionTable(segments[1].data)) {
    fail('Bảng phân vùng gói firmware không phải default_8MB. Chưa ghi flash.');
  }
  const app = segments[3].data;
  if (app.length < 24 || app[0] !== 0xe9 || app[12] !== 9 || app[13] !== 0) {
    fail('Firmware app.bin không khớp ESP32-S3. Chưa ghi flash.');
  }
}

async function checkChipSecurityForInitialize(loader) {
  if (typeof loader.getSecurityInfo !== 'function') return;
  let sec;
  try {
    sec = await loader.getSecurityInfo();
  } catch (err) {
    throw new Error('Không thể xác định trạng thái bảo mật chip; hủy khởi tạo để đảm bảo an toàn. Chưa ghi flash.', { cause: err });
  }
  const secureBoot = Boolean(sec?.parsedFlags?.SECURE_BOOT_EN || sec?.secureBoot);
  const flashEnc = Boolean(sec?.parsedFlags?.FLASH_ENCRYPT_EN || sec?.flashEncryption || (typeof sec?.flashCryptCnt === 'number' && (sec.flashCryptCnt % 2 === 1)));
  if (secureBoot || flashEnc) {
    throw new Error('Chip đang bật Secure Boot hoặc Flash Encryption; không thể khởi tạo lại an toàn. Chưa ghi flash.');
  }
}

async function resolveWrittenData(loader, segment, flashMode, flashFreq, flashSize) {
  let data = segment.data;
  if (typeof loader._updateImageFlashParams === 'function') {
    const rem = data.length % 4;
    if (rem !== 0) {
      const padded = new Uint8Array(data.length + (4 - rem));
      padded.fill(0xff);
      padded.set(data);
      data = padded;
    }
    data = await loader._updateImageFlashParams(data, segment.address, flashMode, flashFreq, flashSize);
  }
  return data;
}

export async function flashPackage(
  port,
  segments,
  log,
  progress,
  load = () => import('esptool-js'),
  { expectedFlashSize = '16MB', mode = 'normal', confirmedInitialize = false } = {},
) {
  if (mode !== 'normal' && mode !== 'initialize') {
    throw new Error(`Chế độ nạp không hợp lệ: ${mode}`);
  }
  if (mode === 'initialize') {
    if (expectedFlashSize !== '8MB') {
      throw new Error('Chế độ Khởi tạo / Ghi đè phân vùng chỉ hỗ trợ Newmania V2 (Flash 8MB). Chưa ghi flash.');
    }
    if (confirmedInitialize !== true) {
      throw new Error('Chưa xác nhận xóa toàn bộ Flash 8MB để khởi tạo. Chưa ghi flash.');
    }
    validateInitializeSegments(segments);
  }

  return withSerialPort(port, async () => {
    await stopSerialSession(port);
    let transport;
    let failure;
    try {
      const { ESPLoader, Transport } = await load();
      transport = new Transport(port);
      const loader = new ESPLoader({transport, baudrate:115200, terminal:{clean(){},write:log,writeLine:log}});
      try {
        await loader.main();
      } catch (connectError) {
        const formatted = formatSerialError(connectError);
        if (formatted !== connectError.message) throw new Error(formatted, { cause: connectError });
        throw connectError;
      }
      if(loader.chip?.CHIP_NAME!=='ESP32-S3') throw new Error('Sai chip: chỉ hỗ trợ ESP32-S3. Chưa ghi flash.');
      if(await loader.detectFlashSize()!==expectedFlashSize) throw new Error(`Flash không phải ${expectedFlashSize}. Chưa ghi.`);

      if (mode === 'normal') {
        const table=segments.find(s=>s.address===0x8000);
        if(!table || await sha256(await loader.readFlash(0x8000,table.data.length))!==await sha256(table.data)) {
          const err = new Error(`Bảng phân vùng hoặc cấu hình board trên mạch không khớp CodeLab (cần ESP32-S3, Flash ${expectedFlashSize}, PartitionScheme=default_8MB). Chưa ghi flash.`);
          err.code = 'PARTITION_MISMATCH';
          throw err;
        }
        await loader.writeFlash({fileArray:segments,flashMode:'keep',flashFreq:'keep',flashSize:'keep',eraseAll:false,compress:true,reportProgress:progress});
        for(const segment of segments) {
          if(await sha256(await loader.readFlash(segment.address,segment.data.length))!==await sha256(segment.data)) throw new Error('Kiểm tra dữ liệu sau nạp thất bại tại 0x'+segment.address.toString(16));
        }
        log('Đã ghi và đọc lại xác minh SHA-256. Đã ghi xong. Chưa chạy chương trình; ngắt nguồn an toàn trước khi bấm RESET trên bo.');
      } else {
        await checkChipSecurityForInitialize(loader);
        const expectedWritten = await Promise.all(
          segments.map(async (segment) => ({
            address: segment.address,
            data: await resolveWrittenData(loader, segment, 'dio', '80m', expectedFlashSize),
          })),
        );
        log('Đang xóa toàn bộ Flash 8MB và ghi lại bootloader + phân vùng CodeLab…');
        try {
          await loader.writeFlash({
            fileArray: segments,
            flashMode: 'dio',
            flashFreq: '80m',
            flashSize: expectedFlashSize,
            eraseAll: true,
            compress: true,
            reportProgress: progress,
          });
          for (const segment of expectedWritten) {
            const actual = await loader.readFlash(segment.address, segment.data.length);
            if (await sha256(actual) !== await sha256(segment.data)) {
              throw new Error('Kiểm tra dữ liệu sau nạp thất bại tại 0x' + segment.address.toString(16));
            }
          }
        } catch (writeErr) {
          throw new Error(
            `Lỗi trong quá trình khởi tạo/ghi Flash: ${writeErr.message}. Firmware trên mạch có thể chưa boot được — hãy kiểm tra cáp USB và thử "Khởi tạo / Ghi đè phân vùng" lại.`,
            { cause: writeErr },
          );
        }
        log('Đã khởi tạo phân vùng, ghi và đọc lại xác minh SHA-256. Chưa chạy chương trình; ngắt nguồn an toàn trước khi bấm RESET trên bo.');
      }
    } catch(error) {
      failure=error;
      throw error;
    } finally {
      if(transport) {
        try { await transport.disconnect(); }
        catch(error) {
          if (!isPortAlreadyClosed(error)) {
            if (!failure) throw error;
            // Cleanup diagnostics must never replace the upload failure.
            try { log(`USB cleanup: ${error.message}`); } catch {}
          }
        }
      }
    }
  });
}
