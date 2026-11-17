import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly';
import { isBrowserCompilerEnabled } from '../src/compiler/config.js';
import { formatSerialError } from '../src/device/usb-port.js';
import { flashPackage } from '../src/device/browser-flash.js';
import { validatePackage, sha256 } from '../src/device/firmware-package.js';
import { fixture } from './fixtures/browser-firmware.mjs';
import { designToolbox, newmaniaWorkspace } from '../src/blocks/newmania.js';
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
  const err = new Error('Failed to open serial port.');
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
