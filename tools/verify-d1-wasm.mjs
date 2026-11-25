import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileD1 } from '../src/compiler/d1-compiler.js';
import { inspectElf } from '../src/compiler/inspect-firmware.js';
import { sha256 } from '../src/device/firmware-package.js';

if (!process.argv[2]) throw new Error('Usage: node tools/verify-d1-wasm.mjs <D1 toolchain.tar.gz>');
const toolchain = new URL('../public/toolchain-337/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', toolchain), 'utf8'));
const load = async (asset) => WebAssembly.compile(Buffer.concat(await Promise.all(
  (asset.chunks || [asset.url]).map((name) => readFile(new URL(name, toolchain))))));
const [clangMod, ldMod, packageBytes] = await Promise.all([
  load(manifest.tools.clang), load(manifest.tools.ld), readFile(resolve(process.argv[2])),
]);
const firmware = new URL('../firmware/', import.meta.url);
const source = (path) => readFile(new URL(path, firmware), 'utf8');
const sources = {
  i2c: await source('ps4_i2c_bridge/ps4_i2c_bridge.ino'),
  uart: await source('demos/ps4_uart_bridge_d1/ps4_uart_bridge_d1.ino'),
  headers: Object.fromEntries(await Promise.all(['I2CFrame.h', 'MappingPublisher.h', 'ReportGate.h', 'Ps4MacSerial.h']
    .map(async (name) => [name, await source(`libraries/CodeLabPs4I2C/src/${name}`)]))),
};

for (const [mode, defaults] of [['i2c', [16, 17]], ['uart', [19, 18]]]) {
  const hashes = [];
  for (const [first, second] of [defaults, [25, 26]]) {
    const { segments, elf } = await compileD1({ clangMod, ldMod, packageBytes, config: { mode, first, second }, sources });
    assert.deepEqual(segments.map(({ address }) => address), [0x1000, 0x8000, 0xe000, 0x10000]);
    assert.ok(inspectElf(elf).constructors.some(({ name }) => name === '_GLOBAL__sub_I_PS4Bluepad32.cpp'));
    const [boot, partition, , app] = segments.map(({ data }) => data);
    assert.equal(boot[3] >> 4, 2);
    assert.equal(boot[12] | boot[13], 0);
    assert.deepEqual(Array.from(partition.subarray(0, 2)), [0xaa, 0x50]);
    assert.equal(app[12] | app[13], 0);
    hashes.push(await sha256(app));
    console.log(`${mode} GPIO${first}/${second}: ESP32 image and PS4 constructor verified, ${app.length} bytes`);
  }
  assert.notEqual(hashes[0], hashes[1], `${mode} GPIO changes must affect the linked firmware`);
}
