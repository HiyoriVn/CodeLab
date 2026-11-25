import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_DEFAULT_PINS, validateD1Config } from '../src/device/d1-firmware-config.js';
import { flashD1Firmware } from '../src/device/browser-flash.js';
import { buildD1Firmware } from '../tools/build-d1-firmware.mjs';

function firmware() {
  const image = Uint8Array.of(0xe9, ...Array(23).fill(0));
  const boot = image.slice();
  boot[3] = 0x20;
  return [boot, Uint8Array.of(0xaa, 0x50, 0, 0), new Uint8Array(8), image]
    .map((data, i) => ({ data, address: [0x1000, 0x8000, 0xe000, 0x10000][i] }));
}

test('D1 modes have the documented defaults and reject duplicate or reserved pins', () => {
  assert.deepEqual(D1_DEFAULT_PINS, { i2c: [16, 17], uart: [19, 18] });
  assert.deepEqual(validateD1Config({ mode: 'uart', first: 25, second: 26 }), { mode: 'uart', first: 25, second: 26 });
  for (const [first, second] of [[16, 16], [6, 17], [19, 35], ['16', 17]]) {
    assert.throws(() => validateD1Config({ mode: 'i2c', first, second }), /GPIO/);
  }
});

test('D1 compile wires both pin mappings into the installed Bluepad32 CLI and surfaces DLL failures', async () => {
  for (const [mode, flags] of [['i2c', '-DCODELAB_D1_SDA=25 -DCODELAB_D1_SCL=26'], ['uart', '-DUART_TX_PIN=25 -DUART_RX_PIN=26']]) {
    const execute = async (args) => {
      if (args[0] === 'core') return { ok: true, output: '{"platforms":[{"id":"esp32-bluepad32:esp32","installed_version":"4.1.0"}]}' };
      assert.ok(args.includes(`compiler.cpp.extra_flags=${flags}`));
      assert.ok(args.includes('esp32-bluepad32:esp32:esp32'));
      if (args.includes('--show-properties=expanded')) return { ok: true, output: 'runtime.platform.path=test' };
      return { ok: false, error: 'Illegal System DLL Relocation' };
    };
    await assert.rejects(buildD1Firmware(execute, { mode, first: 25, second: 26 }), /Windows không khởi chạy/);
  }
});

test('D1 flash verifies every segment and rejects wrong chip or partition before writing', async () => {
  for (const failure of [null, 'chip', 'partition', 'readback', 'secure']) {
    let writes = 0;
    let disconnects = 0;
    const segments = firmware();
    class MockLoader {
      chip = { CHIP_NAME: failure === 'chip' ? 'ESP32-S3' : 'ESP32' };
      async main() {}
      async detectFlashSize() { return '4MB'; }
      async readReg(address) { return failure === 'secure' && address === 0x3ff5a018 ? 0x10 : 0; }
      async readFlash(address, length) {
        if (failure === 'partition' || (failure === 'readback' && writes)) return new Uint8Array(length);
        return segments.find((segment) => segment.address === address).data;
      }
      async writeFlash(options) { assert.equal(options.eraseAll, false); writes++; }
    }
    class MockTransport { async disconnect() { disconnects++; } }
    const flash = flashD1Firmware({}, segments, () => {}, () => {}, async () => ({ ESPLoader: MockLoader, Transport: MockTransport }));
    if (failure) await assert.rejects(flash);
    else await flash;
    assert.equal(writes, !failure || failure === 'readback' ? 1 : 0);
    assert.equal(disconnects, 1);
  }
});
