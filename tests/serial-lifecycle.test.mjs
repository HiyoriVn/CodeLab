import test from 'node:test';
import assert from 'node:assert/strict';
import { createSerialSession, withSerialPort, stopSerialSession, isPortAlreadyClosed } from '../src/device/serial-lifecycle.js';
import { formatSerialError } from '../src/device/usb-port.js';
import { flashPackage } from '../src/device/browser-flash.js';
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
test('generic NetworkError remains accurate; explicit busy is recognized', () => {
  assert.equal(formatSerialError(new DOMException('Device disconnected', 'NetworkError')), 'Device disconnected');
  assert.equal(formatSerialError(new DOMException('Failed to open serial port', 'NetworkError')), 'Failed to open serial port');
  assert.notEqual(formatSerialError(new Error('Port busy')), 'Port busy');
  assert.equal(isPortAlreadyClosed(new DOMException('The port is already closed.', 'InvalidStateError')), true);
  assert.equal(isPortAlreadyClosed(new DOMException('Port is locked', 'InvalidStateError')), false);
});
test('Serial to Flash awaits cancellation, read-loop release and pending writes; double disconnect closes once', async () => {
  const events = [], cancel = deferred(), read = deferred(), write = deferred();
  const port = {
    async open() { events.push('open'); },
    readable: { getReader() { return {
      read: () => read.promise,
      async cancel() { events.push('cancel'); await cancel.promise; read.resolve({done:true}); },
      releaseLock() { events.push('release'); },
    }; } },
    writable: { getWriter() { return { write: () => write.promise, releaseLock() { events.push('writer-release'); } }; } },
    async close() { events.push('close'); },
  };
  const session = createSerialSession();
  await session.connect(port, {}, () => {}, assert.fail);
  const writing = session.write(new Uint8Array());
  const first = session.disconnect(), second = session.disconnect();
  const flash = withSerialPort(port, async () => { await stopSerialSession(port); events.push('flash'); });
  await new Promise(r => setImmediate(r));
  assert.deepEqual(events, ['open', 'cancel']);
  cancel.resolve();
  await new Promise(r => setImmediate(r));
  assert.deepEqual(events, ['open', 'cancel', 'release']);
  write.resolve(); await Promise.all([first, second, flash, writing]);
  assert.deepEqual(events, ['open', 'cancel', 'release', 'writer-release', 'close', 'flash']);
});
test('flash cleanup ignores only already-closed after success and preserves initial failure identity', async () => {
  const original = new Error('Upload failed');
  class Transport { async disconnect() { throw new DOMException('The port is already closed.', 'InvalidStateError'); } }
  class ESPLoader { async main() { throw original; } }
  await assert.rejects(flashPackage({}, [], () => {}, () => {}, async () => ({Transport, ESPLoader})), e => e === original);
});
test('failed busy open leaves no owned port to close and queue recovers', async () => {
  let closes = 0;
  const port = { async open() { throw new DOMException('Port busy', 'NetworkError'); }, async close() { closes++; } };
  const session = createSerialSession();
  await assert.rejects(session.connect(port, {}, () => {}, assert.fail), /busy/);
  await session.disconnect();
  assert.equal(closes, 0);
  await withSerialPort(port, async () => {});
});
test('already closed cleanup is idempotent, while other close errors remain visible', async () => {
  for (const alreadyClosed of [true, false]) {
    const session = createSerialSession();
    const error = new DOMException(alreadyClosed ? 'The port is already closed.' : 'Port is locked', 'InvalidStateError');
    const port = { open: async () => {}, close: async () => { throw error; } };
    await session.connect(port, {}, () => {}, assert.fail);
    if (alreadyClosed) { await session.disconnect(); await session.disconnect(); }
    else await assert.rejects(session.disconnect(), e => e === error);
  }
});
test('a successful flash ignores already-closed cleanup but reports other cleanup errors', async () => {
  const data = new Uint8Array([1,2,3]);
  for (const closed of [true, false]) {
    const error = new DOMException(closed ? 'The port is already closed.' : 'Port is locked', 'InvalidStateError');
    class Transport { async disconnect() { throw error; } }
    class ESPLoader {
      chip = { CHIP_NAME: 'ESP32-S3' };
      async main() {} async detectFlashSize() { return '16MB'; }
      async readFlash() { return data; } async writeFlash() {}
    }
    const run = flashPackage({}, [{address:0x8000,data}], () => {}, () => {}, async () => ({Transport,ESPLoader}));
    if (closed) await run; else await assert.rejects(run, e => e === error);
  }
});
test('flash waits for an in-flight open and closes Serial before transport starts', async () => {
  const opened = deferred(), events = [], session = createSerialSession();
  const port = { async open() { events.push('opening'); await opened.promise; }, async close() { events.push('closed'); } };
  const connect = session.connect(port, {}, () => {}, assert.fail);
  const original = new Error('intentional connection failure');
  class Transport { constructor() { events.push('transport'); } async disconnect() {} }
  class ESPLoader { async main() { throw original; } }
  const flash = flashPackage(port, [], () => {}, () => {}, async () => ({Transport,ESPLoader}));
  const rejected = assert.rejects(flash, e => e === original);
  await new Promise(r => setImmediate(r));
  assert.deepEqual(events, ['opening']);
  opened.resolve(); await connect; await rejected;
  assert.deepEqual(events, ['opening', 'closed', 'transport']);
});
