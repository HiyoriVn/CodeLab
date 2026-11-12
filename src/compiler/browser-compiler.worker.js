import { Vfs } from './vfs.js';
import { untar, gunzip } from './tar.js';
import { runWasi } from './wasi-runner.js';
import { addPrototypes } from './prototypes.js';
import { elfToImage } from './esp-image.js';
import { validatePackage, sha256 } from '../device/firmware-package.js';
import { FAST4WD_BOARD_ID, getBoardProfile } from '../boards/profiles.js';

let toolchainCache = null;
const libObjectCache = new Map();

async function sha256Hex(data) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(hashBuf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchChunkedAsset(baseUrl, fileName, chunks, cacheName, onProgress) {
  const cache = 'caches' in self ? await caches.open(cacheName) : undefined;
  const chunkList = chunks && chunks.length > 0 ? chunks : [fileName];

  const buffers = new Array(chunkList.length);
  let completed = 0;
  const concurrency = 3;

  for (let i = 0; i < chunkList.length; i += concurrency) {
    const batch = chunkList.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (chunkName, batchIdx) => {
        const idx = i + batchIdx;
        const chunkUrl = new URL(chunkName, baseUrl).toString();
        let res = await cache?.match(chunkUrl);
        if (!res) {
          res = await fetch(chunkUrl);
          if (!res.ok) throw new Error(`Không thể tải tệp ${chunkName}: ${res.status}`);
          await cache?.put(chunkUrl, res.clone());
        }
        buffers[idx] = new Uint8Array(await res.arrayBuffer());
        completed++;
        onProgress?.(`Đang tải tài nguyên (${completed}/${chunkList.length})…`);
      })
    );
  }

  if (buffers.length === 1) return buffers[0];
  const totalLen = buffers.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

async function getToolchain(manifestUrl, onProgress) {
  if (toolchainCache) return toolchainCache;

  onProgress?.('Đang tải manifest toolchain Core 3.3.7…');
  const manifestRes = await fetch(manifestUrl);
  if (!manifestRes.ok) throw new Error(`Lỗi tải manifest: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const cacheName = `codelab-toolchain-${manifest.version || '3.3.7'}`;
  const baseUrl = new URL(manifestUrl, self.location.href).toString();

  onProgress?.('Đang tải các tệp toolchain WebAssembly…');
  const [clangBytes, ldBytes, sysrootGz, bootloader, partitionTable, bootApp0] = await Promise.all([
    fetchChunkedAsset(baseUrl, manifest.tools.clang.url, manifest.tools.clang.chunks, cacheName, onProgress),
    fetchChunkedAsset(baseUrl, manifest.tools.ld.url, manifest.tools.ld.chunks, cacheName, onProgress),
    fetchChunkedAsset(baseUrl, manifest.sysroot, manifest.sysrootChunks, cacheName, onProgress),
    fetchChunkedAsset(baseUrl, manifest.bootloader, undefined, cacheName, onProgress),
    fetchChunkedAsset(baseUrl, manifest.partitionTable, undefined, cacheName, onProgress),
    fetchChunkedAsset(baseUrl, manifest.bootApp0 || 'boot_app0.bin', undefined, cacheName, onProgress),
  ]);

  onProgress?.('Đang biên dịch WebAssembly module (Clang + LD)…');
  const [clangMod, ldMod, sysrootTar] = await Promise.all([
    WebAssembly.compile(clangBytes),
    WebAssembly.compile(ldBytes),
    gunzip(sysrootGz),
  ]);

  onProgress?.('Đang giải nén sysroot vào bộ nhớ VFS…');
  const vfs = new Vfs(untar(sysrootTar));

  onProgress?.('Đang tải thư viện CodeLab…');
  const pocDataRes = await fetch(new URL('codelab-poc-data.json', baseUrl).toString());
  if (!pocDataRes.ok) throw new Error('Không thể tải thư viện CodeLab từ toolchain.');
  const pocData = await pocDataRes.json();

  toolchainCache = {
    manifest,
    clangMod,
    ldMod,
    vfs,
    bootloader,
    partitionTable,
    bootApp0,
    libraries: pocData.libraries,
  };
  return toolchainCache;
}

self.onmessage = async (ev) => {
  const req = ev.data;
  if (!req || req.action !== 'compile') return;

  const t0 = performance.now();
  const post = (msg) => self.postMessage(msg);

  try {
    const { code, boardId, toolchainUrl = '/toolchain-337/manifest.json' } = req;
    if (boardId !== FAST4WD_BOARD_ID) {
      throw new Error(`Browser compiler chỉ hỗ trợ board ${FAST4WD_BOARD_ID} (Core 3.3.7).`);
    }
    if (!code || typeof code !== 'string') {
      throw new Error('Mã nguồn C++ không hợp lệ.');
    }

    const tc = await getToolchain(toolchainUrl, (msg) => post({ type: 'progress', message: msg }));
    const { vfs, clangMod, ldMod, manifest, bootloader, partitionTable, bootApp0, libraries } = tc;

    post({ type: 'progress', message: 'Đang chuẩn bị workspace biên dịch…' });
    vfs.resetDir('src');
    vfs.resetDir('build');
    vfs.resetDir('libs');

    for (const lib of libraries) {
      for (const f of lib.files) {
        vfs.writeFile(`libs/${lib.id}/${f.path}`, f.content);
      }
    }
    const libIncludes = libraries.flatMap((lib) =>
      lib.includeDirs.flatMap((d) => ['-isystem', `/libs/${lib.id}/${d === '.' ? '' : d}`])
    );

    const commonFlags = vfs.readText('sysroot/flags/common.txt').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const cflags = vfs.readText('sysroot/flags/c.txt').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const cxxflags = vfs.readText('sysroot/flags/cxx.txt').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const linkArgsTemplate = vfs.readText('sysroot/flags/link.txt').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

    const sketchCode = addPrototypes(code, '/src/sketch.ino');
    vfs.writeFile('src/sketch.ino', sketchCode);

    post({ type: 'progress', message: 'Đang biên dịch C++ qua Clang WASM…' });
    const tComp0 = performance.now();
    const sketchRes = await runWasi(
      clangMod,
      [
        'clang',
        ...commonFlags,
        ...cxxflags,
        '-Wno-c++11-narrowing',
        ...libIncludes,
        '-x',
        'c++',
        '-include',
        'Arduino.h',
        '-fno-color-diagnostics',
        '-c',
        '/src/sketch.ino',
        '-o',
        '/build/sketch.o',
      ],
      vfs
    );
    if (sketchRes.exitCode !== 0) {
      throw new Error(`Lỗi biên dịch C++:\n${sketchRes.stderr || sketchRes.stdout}`);
    }

    const objects = ['/build/sketch.o'];

    // Compile library sources (with in-worker caching)
    for (const lib of libraries) {
      for (const f of lib.files) {
        if (/\.(cpp|cxx|cc|c|S)$/.test(f.path)) {
          const cacheKey = `${lib.id}:${f.path}`;
          const objVirt = `/build/lib_${objects.length}.o`;
          let cached = libObjectCache.get(cacheKey);
          if (cached) {
            vfs.writeFile(objVirt.slice(1), cached);
          } else {
            const isC = f.path.endsWith('.c');
            const res = await runWasi(
              clangMod,
              [
                'clang',
                ...commonFlags,
                ...(isC ? cflags : [...cxxflags, '-Wno-c++11-narrowing']),
                ...libIncludes,
                '-w',
                '-c',
                `/libs/${lib.id}/${f.path}`,
                '-o',
                objVirt,
              ],
              vfs
            );
            if (res.exitCode !== 0) throw new Error(`Lỗi biên dịch thư viện ${f.path}:\n${res.stderr}`);
            cached = vfs.readFile(objVirt);
            libObjectCache.set(cacheKey, cached);
          }
          objects.push(objVirt);
        }
      }
    }
    const compileMs = Math.round(performance.now() - tComp0);

    post({ type: 'progress', message: 'Đang liên kết các module ELF…' });
    const tLink0 = performance.now();
    const linkArgs = linkArgsTemplate.flatMap((a) =>
      a === '@OBJECTS@' ? objects : [a.replace('@OUTPUT@', '/build/app.elf')]
    );
    const linkRes = await runWasi(ldMod, ['ld', ...linkArgs], vfs);
    if (linkRes.exitCode !== 0) {
      throw new Error(`Lỗi liên kết (Linker):\n${linkRes.stderr || linkRes.stdout}`);
    }
    const linkMs = Math.round(performance.now() - tLink0);

    const elfBytes = vfs.readFile('/build/app.elf');

    post({ type: 'progress', message: 'Đang tạo ảnh nhị phân ESP32-S3 (16MB DIO)…' });
    const appBin = await elfToImage(elfBytes, {
      flashMode: 'dio',
      flashFreq: '80m',
      flashSize: '16MB',
      appendSha256: true,
    });

    post({ type: 'progress', message: 'Đang kiểm tra an toàn gói firmware (validatePackage)…' });
    const segBuffers = [
      { name: 'bootloader.bin', address: 0x0, data: bootloader },
      { name: 'partitions.bin', address: 0x8000, data: partitionTable },
      { name: 'boot_app0.bin', address: 0xe000, data: bootApp0 },
      { name: 'app.bin', address: 0x10000, data: appBin },
    ];

    const segHashes = await Promise.all(segBuffers.map((s) => sha256Hex(s.data)));
    const manifestFlash = {
      version: 1,
      boardId: FAST4WD_BOARD_ID,
      chip: 'ESP32-S3',
      core: '3.3.7',
      fqbn: getBoardProfile(FAST4WD_BOARD_ID).build.fqbn,
      segments: segBuffers.map((s, idx) => ({
        file: s.name,
        address: s.address,
        sha256: segHashes[idx],
      })),
    };

    const filesFlash = segBuffers.map((s) => ({
      name: s.name,
      size: s.data.length,
      arrayBuffer: async () => {
        const copy = new Uint8Array(s.data.byteLength);
        copy.set(s.data);
        return copy.buffer;
      },
    }));

    // Perform exact CodeLab validatePackage check
    const validatedSegments = await validatePackage(manifestFlash, filesFlash, sha256);

    const codeHash = await sha256Hex(new TextEncoder().encode(code));
    const buildId = `wasm-${codeHash.slice(0, 12)}-${boardId}-${manifest.version || '3.3.7'}`;

    post({
      type: 'done',
      buildId,
      boardId,
      code,
      toolchainVersion: manifest.version,
      manifest: manifestFlash,
      segments: validatedSegments,
      stats: {
        compileMs,
        linkMs,
        totalMs: Math.round(performance.now() - t0),
        elfSize: elfBytes.length,
        appBinSize: appBin.length,
      },
    });
  } catch (err) {
    post({
      type: 'error',
      error: err.message || String(err),
    });
  }
};
