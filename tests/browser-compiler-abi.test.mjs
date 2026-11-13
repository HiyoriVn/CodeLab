import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Vfs } from '../src/compiler/vfs.js';
import { runWasi } from '../src/compiler/wasi-runner.js';
import { parseElf } from '../src/compiler/elf.js';
import { XTENSA_ABI_FLAGS, validateConstructorAbi } from '../src/compiler/xtensa-abi.js';

test('actual Xtensa Clang constructor ABI: driver flag alone is ignored; cc1 emits retained .ctors', async () => {
  const manifest = JSON.parse(fs.readFileSync('public/toolchain-337/manifest.json', 'utf8'));
  const module = await WebAssembly.compile(Buffer.concat(manifest.tools.clang.chunks.map(p => fs.readFileSync(`public/toolchain-337/${p}`))));
  const vfs = new Vfs();
  vfs.writeFile('src/probe.cpp', 'extern void touch(); struct A { A(){touch();} }; A a;');
  for (const [flags, valid] of [[[], false], [['-fno-use-init-array'], false], [XTENSA_ABI_FLAGS, true]]) {
    vfs.resetDir('build');
    const result = await runWasi(module, ['clang', '--target=xtensa-esp-elf', '-mcpu=esp32s3', ...flags, '-c', '/src/probe.cpp', '-o', '/build/probe.o'], vfs);
    assert.equal(result.exitCode, 0, result.stderr);
    const object = vfs.readFile('build/probe.o');
    if (valid) {
      assert.doesNotThrow(() => validateConstructorAbi(object));
      assert.ok(parseElf(object).sections.some(s => s.name === '.ctors' && s.size === 4));
      assert.ok(parseElf(object).sections.some(s => s.name === '.debug_info' && s.size));
    } else {
      assert.throws(() => validateConstructorAbi(object), /Unsupported constructor section .init_array/);
    }
  }
});
