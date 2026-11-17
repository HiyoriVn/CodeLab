import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import * as Blockly from 'blockly';
import { inspectElf, verifyImage } from '../src/compiler/inspect-firmware.js';
import { isBrowserCompilerEnabled } from '../src/compiler/config.js';
import { formatSerialError } from '../src/device/usb-port.js';
import { flashPackage } from '../src/device/browser-flash.js';
import { validatePackage, sha256 } from '../src/device/firmware-package.js';
import { fixture } from './fixtures/browser-firmware.mjs';
import { designToolbox, newmaniaWorkspace } from '../src/blocks/newmania.js';
import { LESSONS, lessonProject } from '../src/lessons/newmania.js';
import { learningCode } from '../src/ui/learning-code.js';
import { generateNewmania } from '../src/generators/newmania.js';
import { FAST4WD_BOARD_ID, getBoardProfile } from '../src/boards/profiles.js';
import { defaultRobotDevices } from '../src/boards/robot-devices.js';

function crc8(bytes) {
  let crc = 0x00;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

test('WASM compiler is enabled on production hostname without URL flag', () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: { hostname: 'codelab.hirovn9395.workers.dev', search: '' },
    localStorage: { getItem: () => null },
  };
  try {
    assert.equal(isBrowserCompilerEnabled(), true);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('PS4 UART protocol header specifies A5 5A + 13 byte + CRC8 0x07 on RX8/TX9 at 115200 baud', () => {
  const uartHeader = readFileSync('firmware/libraries/CodeLabPs4I2C/src/UartFrame.h', 'utf8');
  assert.match(uartHeader, /uartHeader0\s*=\s*0xA5/);
  assert.match(uartHeader, /uartHeader1\s*=\s*0x5A/);
  assert.match(uartHeader, /uartBaud\s*=\s*115200/);
  assert.match(uartHeader, /uartRxPin\s*=\s*8/);
  assert.match(uartHeader, /uartTxPin\s*=\s*9/);
  assert.match(uartHeader, /0x07/);
  assert.equal(crc8(Uint8Array.from([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39])), 0xf4);

  const fast4wdHeader = readFileSync('firmware/libraries/CodeLabFast4wd/src/CodeLabFast4wd.h', 'utf8');
  assert.match(fast4wdHeader, /enum class Ps4Transport : uint8_t \{ I2c = 0, Uart = 1 \}/);
  assert.match(fast4wdHeader, /Serial1\.begin\(ps4i2c::uartBaud, SERIAL_8N1, ps4i2c::uartRxPin, ps4i2c::uartTxPin\)/);
  assert.match(fast4wdHeader, /Wire\.begin\(8, 9, uint32_t\(100000\)\)/);
});

test('Newmania generator defaults to UART and preserves legacy I2C compatibility', () => {
  const w = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), w);
  const devices = defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID));
  const uartGen = generateNewmania(w, FAST4WD_BOARD_ID, devices);
  assert.deepEqual(uartGen.warnings, []);
  assert.match(uartGen.code, /newmania\.begin\(true, false, 130303UL, 7\);/);

  const i2cGen = generateNewmania(w, FAST4WD_BOARD_ID, {
    ...devices,
    controller: { ...devices.controller, transport: 'i2c' },
  });
  assert.deepEqual(i2cGen.warnings, []);
  assert.match(i2cGen.code, /fast4wd::Ps4Transport::I2c/);
  w.dispose();
});

test('Servo S1-S4 (GPIO12-15) blocks are present on Newmania toolbox', () => {
  const toolbox = designToolbox();
  const servoCat = toolbox.contents.find((c) => c.name === 'Servo');
  assert.ok(servoCat, 'Servo category must be present');
  assert.deepEqual(servoCat.contents.map((b) => b.type), ['robot_servo_write', 'robot_servo_disable']);
  assert.deepEqual(getBoardProfile(FAST4WD_BOARD_ID).pins.servos, [12, 13, 14, 15]);
});

test('formatSerialError reports clear message when COM port is occupied', () => {
  const err = new Error('Serial port is busy.');
  err.name = 'NetworkError';
  assert.match(formatSerialError(err), /Cổng COM đang bị phần mềm khác chiếm/);
});

test('flashPackage blocks mismatched board/partition layout with clear error and never writes flash', async () => {
  const { manifest, files } = fixture();
  const segments = await validatePackage(manifest, files, sha256);
  const installedSector = new Uint8Array(4096).fill(0xff); // mismatched / blank partition sector

  const writes = [];
  const load = async () => ({
    Transport: class { async disconnect() {} },
    ESPLoader: class {
      chip = { CHIP_NAME: 'ESP32-S3' };
      async main() {}
      async detectFlashSize() { return '16MB'; }
      async readFlash(addr, len) {
        if (addr === 0x8000) return installedSector.subarray(0, len);
        const seg = segments.find((s) => s.address === addr);
        return seg.data;
      }
      async writeFlash(opts) { writes.push(opts); }
    },
  });

  await assert.rejects(
    () => flashPackage({}, segments, () => {}, () => {}, load),
    /Bảng phân vùng hoặc cấu hình board trên mạch không khớp CodeLab/
  );
  assert.equal(writes.length, 0);
});

test('WASM toolchain packages PS4 UART and compiles a real PS4 + Servo sketch into valid ESP32-S3 firmware', async () => {
  const pocData = JSON.parse(readFileSync('public/toolchain-337/codelab-poc-data.json', 'utf8'));
  const ps4Lib = pocData.libraries.find((l) => l.id === 'CodeLabPs4I2C');
  const uartFile = ps4Lib?.files.find((f) => f.path === 'src/UartFrame.h');
  assert.ok(uartFile, 'UartFrame.h must be packaged in CodeLabPs4I2C');
  assert.match(uartFile.content, /uartRxPin\s*=\s*8/);
  assert.match(uartFile.content, /uartTxPin\s*=\s*9/);
  assert.match(uartFile.content, /uartBaud\s*=\s*115200/);

  const w = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(newmaniaWorkspace(), w);
  const root = w.getBlocksByType('newmania_design_program', false)[0];
  const connect = w.newBlock('newmania_design_ps4_connect');
  const servoWrite = w.newBlock('robot_servo_write');
  const angle = w.newBlock('math_number');
  angle.setFieldValue(90, 'NUM');
  servoWrite.getInput('ANGLE').connection.connect(angle.outputConnection);
  const servoDisable = w.newBlock('robot_servo_disable');
  const forever = w.getBlocksByType('newmania_design_forever', false)[0] || w.newBlock('newmania_design_forever');
  const ifBtn = w.newBlock('controls_if');
  const btn = w.newBlock('newmania_design_ps4_button');
  ifBtn.getInput('IF0').connection.connect(btn.outputConnection);
  ifBtn.getInput('DO0').connection.connect(servoWrite.previousConnection);
  servoWrite.nextConnection.connect(servoDisable.previousConnection);
  forever.getInput('DO').connection.connect(ifBtn.previousConnection);
  root.getInput('DO').connection.connect(connect.previousConnection);
  connect.nextConnection.connect(forever.previousConnection);

  const devices = defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID));
  const generated = generateNewmania(w, FAST4WD_BOARD_ID, devices);
  w.dispose();
  assert.deepEqual(generated.warnings, []);
  assert.match(generated.code, /newmania\.connectPs4\(\)/);
  assert.match(generated.code, /newmania\.servoWrite\(1, 90\.0\)/);
  assert.match(generated.code, /newmania\.servoDisable\(1\)/);

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
    await self.onmessage({ data: { action: 'compile', requestId: 99, code: generated.code, boardId: FAST4WD_BOARD_ID } });
    assert.equal(workerResult?.type, 'done', workerResult?.error || 'WASM compile failed');
    assert.equal(workerResult.requestId, 99);
    assert.equal(workerResult.segments.length, 4);
    const elf = workerResult.debug.elf;
    const app = workerResult.segments.find((s) => s.address === 0x10000).data;
    const info = inspectElf(elf);
    assert.ok(info.constructors.some((c) => c.name === '_GLOBAL__sub_I_sketch.ino'));
    await verifyImage(elf, app);
  } finally {
    globalThis.self = oldSelf;
    globalThis.fetch = oldFetch;
  }
});

test('browser UI keeps background compile across popup close, reuses cache, and shares single USB between Flash and Serial', async () => {
  const folder = resolve('firmware/tests/build-output/release-ui');
  mkdirSync(folder, { recursive: true });
  await build({
    stdin: {
      contents: `
        import React from 'react';
        import DevicePanel from './src/components/DevicePanel.jsx';
        import SerialMonitor from './src/components/SerialMonitor.jsx';
        import { useDeviceOperation } from './src/device/useDeviceOperation.js';
        import { useSharedUsbPort } from './src/device/usb-port.js';
        import { FAST4WD_BOARD_ID } from './src/boards/profiles.js';
        export function Harness({ code, configKey = 'cfg', compileFn }) {
          const operation = useDeviceOperation();
          const usbPort = useSharedUsbPort();
          const cacheRef = React.useRef(new Map());
          const [open, setOpen] = React.useState(true);
          const [compileState, setCompileState] = React.useState({ status: 'idle', cacheKey: '', message: '', build: null });
          const cacheKey = code ? FAST4WD_BOARD_ID + '\\0' + configKey + '\\0' + code : '';
          const effectiveBuild = compileState.cacheKey === cacheKey && compileState.build
            ? compileState.build : (cacheRef.current.get(cacheKey) ?? null);
          const onCompile = async () => {
            const hit = cacheRef.current.get(cacheKey);
            if (hit) { setCompileState({ status: 'ready', cacheKey, message: 'cached', build: hit }); return hit; }
            setCompileState({ status: 'compiling', cacheKey, message: 'compiling', build: null });
            const res = await compileFn(code);
            const entry = { id: res.buildId, code, boardId: FAST4WD_BOARD_ID, package: res };
            cacheRef.current.set(cacheKey, entry);
            setCompileState({ status: 'ready', cacheKey, message: 'done', build: entry });
            return entry;
          };
          return <>
            <button onClick={() => setOpen((v) => !v)}>{open ? 'Đóng popup' : 'Mở popup'}</button>
            {open && <DevicePanel operation={operation} usbPort={usbPort} compileCache={{ state: compileState, activeCacheKey: cacheKey, effectiveBuild, onCompile }} boardId={FAST4WD_BOARD_ID} code={code} warnings={[]} />}
            <SerialMonitor usbPort={usbPort} />
          </>;
        }
      `,
      resolveDir: process.cwd(),
      loader: 'jsx',
    },
    bundle: true,
    packages: 'external',
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    outfile: join(folder, 'harness.mjs'),
  });
  const { Harness } = await import(pathToFileURL(join(folder, 'harness.mjs')));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://codelab.hirovn9395.workers.dev/' });
  const saved = new Map();
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  Object.defineProperty(window, 'isSecureContext', { value: true });
  let requestPortCalls = 0;
  let portOpenCalls = 0;
  let portCloseCalls = 0;
  const mockPort = {
    getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }),
    readable: { getReader: () => ({ read: () => new Promise(() => {}), releaseLock() {}, cancel: async () => {} }) },
    open: async () => { portOpenCalls++; },
    close: async () => { portCloseCalls++; },
  };
  navigator.serial = {
    requestPort: async () => { requestPortCalls++; return mockPort; },
    addEventListener() {},
    removeEventListener() {},
  };
  let resolveCompile;
  let compileCount = 0;
  const compileFn = () => {
    compileCount++;
    return new Promise((r) => { resolveCompile = r; });
  };
  const tick = () => new Promise((r) => setTimeout(r, 15));
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const btn = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(label));

  try {
    await act(async () => { root.render(createElement(Harness, { code: 'void setup(){}', compileFn })); await tick(); });
    // Start compile, then immediately close popup while compile is in-flight
    await act(async () => { btn('Biên dịch chương trình').click(); await tick(); });
    assert.equal(compileCount, 1);
    await act(async () => { btn('Đóng popup').click(); await tick(); });
    // Finish compile while popup is closed, then reopen popup
    await act(async () => {
      resolveCompile({ buildId: 'b1', boardId: FAST4WD_BOARD_ID, segments: [], stats: { totalMs: 10 }, manifest: { fqbn: 'esp32' } });
      await tick();
    });
    await act(async () => { btn('Mở popup').click(); await tick(); });
    assert.equal(btn('Chọn USB và nạp').disabled, false, 'Cached build must remain ready after reopening popup');
    // Clicking compile again with unchanged code reuses cache
    await act(async () => { btn('Biên dịch chương trình').click(); await tick(); });
    assert.equal(compileCount, 1, 'Unchanged code must reuse cached build without recompiling');

    // Connect Serial Monitor (1st and only requestPort call)
    await act(async () => { btn('Chọn cổng & kết nối').click(); await tick(); });
    assert.equal(requestPortCalls, 1);
    assert.equal(portOpenCalls, 1);
    // DevicePanel now sees shared USB port without asking again
    assert.ok(btn('Nạp qua USB 303A:1001'), 'DevicePanel must reuse the shared USB port');
  } finally {
    await act(async () => { root.unmount(); });
    for (const [name, desc] of saved) {
      if (desc) Object.defineProperty(globalThis, name, desc);
      else delete globalThis[name];
    }
  }
});

test('Lesson 06 tests Servo S1-S4 at 60/90/120 deg without PS4 or motors, and pseudocode uses UART', () => {
  assert.ok(LESSONS.some((l) => l.id === 'servo_test' && l.label === 'Bài 06 — Kiểm tra Servo S1–S4'));
  const proj = lessonProject('servo_test');
  const w = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(proj.workspace, w);
  const generated = generateNewmania(w, proj.boardId, proj.deviceConfigs[proj.boardId]);
  w.dispose();
  assert.deepEqual(generated.warnings, []);
  for (const ch of [1, 2, 3, 4]) {
    assert.match(generated.code, new RegExp(`newmania\\.servoWrite\\(${ch}, 60\\.0\\)`));
    assert.match(generated.code, new RegExp(`newmania\\.servoWrite\\(${ch}, 90\\.0\\)`));
    assert.match(generated.code, new RegExp(`newmania\\.servoWrite\\(${ch}, 120\\.0\\)`));
    assert.match(generated.code, new RegExp(`newmania\\.servoDisable\\(${ch}\\)`));
  }
  assert.doesNotMatch(generated.code, /connectPs4/);
  assert.doesNotMatch(generated.code, /newmania\.spin|newmania\.power|newmania\.mecanum/);

  const pseudo = learningCode({ blocks: { blocks: [{ type: 'newmania_design_ps4_connect' }] } });
  assert.match(pseudo, /UART/);
  assert.doesNotMatch(pseudo, /I²C/);
});
