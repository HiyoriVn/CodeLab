import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { V2_BOARD_ID, FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { validatePackage } from '../src/device/firmware-package.js';
import { flashPackage } from '../src/device/browser-flash.js';
import { isPortAlreadyClosed, withSerialPort, createSerialSession } from '../src/device/serial-lifecycle.js';

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

function makeV2Segments({ bootloaderFlashSizeNibble = 3 } = {}) {
  const boot = new Uint8Array(256);
  boot[0] = 0xe9;
  boot[2] = 2; // dio
  boot[3] = (bootloaderFlashSizeNibble << 4) | 0x0f; // 80m
  boot[12] = 9; // ESP32-S3

  const part = new Uint8Array(3072);
  const entries = [
    [1, 2, 0x9000, 0x5000],
    [1, 0, 0xe000, 0x2000],
    [0, 16, 0x10000, 0x330000],
    [0, 17, 0x340000, 0x330000],
    [1, 130, 0x670000, 0x180000],
    [1, 3, 0x7f0000, 0x10000],
  ];
  const dv = new DataView(part.buffer);
  entries.forEach((e, i) => {
    const o = i * 32;
    part.set([0xaa, 0x50, e[0], e[1]], o);
    dv.setUint32(o + 4, e[2], true);
    dv.setUint32(o + 8, e[3], true);
  });
  part.set([0xeb, 0xeb], 192);

  const bootApp0 = new Uint8Array(8192);
  const app = new Uint8Array(256);
  app[0] = 0xe9;
  app[12] = 9;

  return [
    { address: 0x0, data: boot },
    { address: 0x8000, data: part },
    { address: 0xe000, data: bootApp0 },
    { address: 0x10000, data: app },
  ];
}

function makeMockFlasher({
  chipName = 'ESP32-S3',
  detectedFlashSize = '8MB',
  initialPartition = null,
  securityInfo = { flags: 0, flashCryptCnt: 0, parsedFlags: { SECURE_BOOT_EN: false, FLASH_ENCRYPT_EN: false } },
  securityError = null,
  writeError = null,
  corruptReadbackAddr = null,
  patchBootloaderByte3 = null,
} = {}) {
  const flash = new Map();
  if (initialPartition) flash.set(0x8000, initialPartition);
  const state = { closed: 0, writes: 0, eraseAllCalls: 0, writeOptions: null };

  class Transport {
    async disconnect() { state.closed++; }
  }
  class ESPLoader {
    constructor() { this.chip = { CHIP_NAME: chipName }; }
    async main() {}
    async detectFlashSize() { return detectedFlashSize; }
    async getSecurityInfo() {
      if (securityError) throw securityError;
      return securityInfo;
    }
    async _updateImageFlashParams(image, address, flashMode, flashFreq, flashSize) {
      if (address === 0 && patchBootloaderByte3 !== null && flashSize !== 'keep') {
        const copy = new Uint8Array(image);
        copy[3] = patchBootloaderByte3;
        return copy;
      }
      return image;
    }
    async readFlash(address, length) {
      const stored = flash.get(address);
      if (!stored) return new Uint8Array(length).fill(0xff); // blank flash
      return stored.slice(0, length);
    }
    async writeFlash(opts) {
      state.writes++;
      state.writeOptions = opts;
      if (opts.eraseAll) {
        state.eraseAllCalls++;
        flash.clear();
      }
      if (writeError) throw writeError;
      for (const seg of opts.fileArray) {
        let data = await this._updateImageFlashParams(seg.data, seg.address, opts.flashMode, opts.flashFreq, opts.flashSize);
        if (corruptReadbackAddr === seg.address) {
          data = new Uint8Array(data);
          data[0] ^= 0xff;
        }
        flash.set(seg.address, data);
      }
    }
  }
  return { load: async () => ({ Transport, ESPLoader }), state, flash };
}

test('1. V2 blank flash: Normal rejects with PARTITION_MISMATCH, Initialize succeeds', async () => {
  const segments = makeV2Segments();
  const blankMock = makeMockFlasher({ detectedFlashSize: '8MB', initialPartition: null });
  await assert.rejects(
    () => flashPackage({}, segments, () => {}, () => {}, blankMock.load, { expectedFlashSize: '8MB', mode: 'normal' }),
    (err) => err.code === 'PARTITION_MISMATCH' && /Bảng phân vùng/.test(err.message),
  );
  assert.equal(blankMock.state.writes, 0);

  const initMock = makeMockFlasher({ detectedFlashSize: '8MB', initialPartition: null });
  const logs = [];
  await flashPackage({}, segments, (m) => logs.push(m), () => {}, initMock.load, {
    expectedFlashSize: '8MB',
    mode: 'initialize',
    confirmedInitialize: true,
  });
  assert.equal(initMock.state.eraseAllCalls, 1);
  assert.equal(initMock.state.writes, 1);
  assert.equal(initMock.state.writeOptions.flashSize, '8MB');
  assert.equal(initMock.state.writeOptions.eraseAll, true);
  assert.ok(logs.some((l) => /Đã khởi tạo phân vùng/.test(l)));
});

test('2. V2 Arduino IDE partition: Normal rejects, Initialize succeeds', async () => {
  const segments = makeV2Segments();
  const arduinoPart = new Uint8Array(3072).fill(0x5a);
  const normalMock = makeMockFlasher({ detectedFlashSize: '8MB', initialPartition: arduinoPart });
  await assert.rejects(
    () => flashPackage({}, segments, () => {}, () => {}, normalMock.load, { expectedFlashSize: '8MB', mode: 'normal' }),
    (err) => err.code === 'PARTITION_MISMATCH',
  );
  assert.equal(normalMock.state.writes, 0);

  const initMock = makeMockFlasher({ detectedFlashSize: '8MB', initialPartition: arduinoPart });
  await flashPackage({}, segments, () => {}, () => {}, initMock.load, {
    expectedFlashSize: '8MB',
    mode: 'initialize',
    confirmedInitialize: true,
  });
  assert.equal(initMock.state.eraseAllCalls, 1);
  assert.equal(initMock.state.writes, 1);
});

test('3. V2 matching CodeLab partition: Normal succeeds without eraseAll', async () => {
  const segments = makeV2Segments();
  const mock = makeMockFlasher({ detectedFlashSize: '8MB', initialPartition: segments[1].data.slice() });
  await flashPackage({}, segments, () => {}, () => {}, mock.load, { expectedFlashSize: '8MB', mode: 'normal' });
  assert.equal(mock.state.eraseAllCalls, 0);
  assert.equal(mock.state.writes, 1);
  assert.equal(mock.state.writeOptions.eraseAll, false);
  assert.equal(mock.state.closed, 1);
});

test('4. V2 16MB, wrong chip, or unsafe security state: Initialize rejects before writing', async () => {
  const segments = makeV2Segments();
  for (const opts of [
    { detectedFlashSize: '16MB' },
    { chipName: 'ESP32' },
    { securityInfo: { flags: 1, flashCryptCnt: 0, parsedFlags: { SECURE_BOOT_EN: true, FLASH_ENCRYPT_EN: false } } },
    { securityInfo: { flags: 0, flashCryptCnt: 1, parsedFlags: { SECURE_BOOT_EN: false, FLASH_ENCRYPT_EN: true } } },
    { securityError: new Error('efuse read failed') },
  ]) {
    const mock = makeMockFlasher(opts);
    await assert.rejects(
      () => flashPackage({}, segments, () => {}, () => {}, mock.load, {
        expectedFlashSize: '8MB',
        mode: 'initialize',
        confirmedInitialize: true,
      }),
    );
    assert.equal(mock.state.eraseAllCalls, 0);
    assert.equal(mock.state.writes, 0);
  }
});

test('5. Unconfirmed Initialize: rejects without erase or write (API & DevicePanel UI)', async () => {
  const segments = makeV2Segments();
  const mock = makeMockFlasher({ detectedFlashSize: '8MB' });
  await assert.rejects(
    () => flashPackage({}, segments, () => {}, () => {}, mock.load, {
      expectedFlashSize: '8MB',
      mode: 'initialize',
      confirmedInitialize: false,
    }),
    /Chưa xác nhận xóa toàn bộ Flash/,
  );
  assert.equal(mock.state.writes, 0);
  assert.equal(mock.state.eraseAllCalls, 0);
});

test('6. Erase/write failure reports clear unbootable warning and never claims success', async () => {
  const segments = makeV2Segments();
  const mock = makeMockFlasher({ detectedFlashSize: '8MB', writeError: new Error('USB timeout') });
  await assert.rejects(
    () => flashPackage({}, segments, () => {}, () => {}, mock.load, {
      expectedFlashSize: '8MB',
      mode: 'initialize',
      confirmedInitialize: true,
    }),
    (err) => /USB timeout/.test(err.message) && /chưa boot được/.test(err.message),
  );
});

test('7. Readback hash mismatch fails; patched bootloader header readback matches actual written bytes', async () => {
  const segments = makeV2Segments();
  const badMock = makeMockFlasher({ detectedFlashSize: '8MB', corruptReadbackAddr: 0x10000 });
  await assert.rejects(
    () => flashPackage({}, segments, () => {}, () => {}, badMock.load, {
      expectedFlashSize: '8MB',
      mode: 'initialize',
      confirmedInitialize: true,
    }),
    /Kiểm tra dữ liệu sau nạp thất bại tại 0x10000/,
  );

  // Even if esptool-js adjusts bootloader flash params during writeFlash, readback compares against actual written bytes
  const patchedMock = makeMockFlasher({ detectedFlashSize: '8MB', patchBootloaderByte3: 0x30 });
  await flashPackage({}, segments, () => {}, () => {}, patchedMock.load, {
    expectedFlashSize: '8MB',
    mode: 'initialize',
    confirmedInitialize: true,
  });
  assert.equal(patchedMock.state.writes, 1);
});

test('8. V1 normal flash remains unchanged with 16MB bootloader and no eraseAll', async () => {
  const v1 = getBoardProfile(FAST4WD_BOARD_ID);
  assert.equal(v1.flashMB, 16);
  const segments = makeV2Segments({ bootloaderFlashSizeNibble: 4 });
  const mock = makeMockFlasher({ detectedFlashSize: '16MB', initialPartition: segments[1].data.slice() });
  await flashPackage({}, segments, () => {}, () => {}, mock.load, { expectedFlashSize: '16MB', mode: 'normal' });
  assert.equal(mock.state.eraseAllCalls, 0);
  assert.equal(mock.state.writes, 1);
  assert.equal(mock.state.writeOptions.flashSize, 'keep');

  // V1 cannot invoke initialize mode
  await assert.rejects(
    () => flashPackage({}, segments, () => {}, () => {}, mock.load, {
      expectedFlashSize: '16MB',
      mode: 'initialize',
      confirmedInitialize: true,
    }),
    /chỉ hỗ trợ Newmania V2/,
  );
});

test('9. Serial Monitor -> Flash lifecycle avoids double-close or race conditions', async () => {
  let closeCount = 0;
  const port = {
    readable: {
      locked: false,
      getReader() {
        return {
          async read() { return { value: undefined, done: true }; },
          async cancel() {},
          releaseLock() {},
        };
      },
    },
    writable: { locked: false },
    async open() {},
    async close() {
      closeCount++;
      if (closeCount > 1) throw new DOMException('The port is already closed.', 'InvalidStateError');
    },
  };
  const session = createSerialSession();
  await session.connect(port, { baudRate: 115200 }, () => {}, () => {});
  const segments = makeV2Segments();
  const mock = makeMockFlasher({ detectedFlashSize: '8MB', initialPartition: segments[1].data.slice() });
  await flashPackage(port, segments, () => {}, () => {}, mock.load, { expectedFlashSize: '8MB', mode: 'normal' });
  assert.equal(closeCount, 1);
  assert.equal(isPortAlreadyClosed(new DOMException('The port is already closed.', 'InvalidStateError')), true);
  await withSerialPort(port, async () => 'ok');
});

test('10. WASM compiler builds V2 package with valid 8MB bootloader and default_8MB partition table', async () => {
  const manifest = JSON.parse(readFileSync('public/toolchain-337/manifest.json', 'utf8'));
  const boot8 = readFileSync('public/toolchain-337/bootloader-8m.bin');
  const boot16 = readFileSync('public/toolchain-337/bootloader.bin');
  assert.equal((boot16[3] >> 4) & 0x0f, 4, 'V1 bootloader remains 16MB');
  assert.equal((boot8[3] >> 4) & 0x0f, 3, 'V2 bootloader is 8MB');
  assert.equal(manifest.bootloader8M, 'bootloader-8m.bin');
  assert.equal(sha256Hex(boot8), manifest.bootloader8MHash);

  const oldSelf = globalThis.self;
  const oldFetch = globalThis.fetch;
  globalThis.self = globalThis;
  self.location = { href: 'http://localhost/' };
  globalThis.fetch = async (url) => {
    const filename = join(process.cwd(), 'public', new URL(url, self.location.href).pathname);
    try { return new Response(readFileSync(filename)); }
    catch { return new Response('', { status: 404 }); }
  };
  let workerResult;
  self.postMessage = (msg) => { if (msg.type !== 'progress') workerResult = msg; };
  try {
    await import('../src/compiler/browser-compiler.worker.js');
    await self.onmessage({
      data: {
        action: 'compile',
        requestId: 777,
        code: '#include <CodeLabNewmania.h>\nusing namespace codelab::newmania;\nvoid setup(){}\nvoid loop(){}\n',
        boardId: V2_BOARD_ID,
      },
    });
    assert.equal(workerResult?.type, 'done', workerResult?.error);
    const bootSeg = workerResult.segments.find((s) => s.address === 0x0);
    assert.equal((bootSeg.data[3] >> 4) & 0x0f, 3);
    assert.equal(sha256Hex(bootSeg.data), manifest.bootloader8MHash);
  } finally {
    globalThis.self = oldSelf;
    globalThis.fetch = oldFetch;
  }
});
