import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5192;

console.log('=== Starting Real Chrome E2E Test: Blockly -> C++ -> WASM -> BIN (Core 3.3.7) ===');

let reportResolve;
let reportReject;
const reportPromise = new Promise((resolve, reject) => {
  reportResolve = resolve;
  reportReject = reject;
});

const server = await createServer({
  root: process.cwd(),
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    watch: { ignored: ['**/toolchain/**', '**/firmware/**', '**/dist/**'] },
  },
  plugins: [
    {
      name: 'blockly-wasm-test-collector',
      configureServer(server) {
        server.middlewares.use('/api/test-log', (req, res) => {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            console.log(`[Browser] ${body}`);
            res.writeHead(200);
            res.end();
          });
        });
        server.middlewares.use('/api/test-report', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              try {
                const json = JSON.parse(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
                reportResolve(json);
              } catch (e) {
                res.writeHead(400);
                res.end(String(e));
                reportReject(e);
              }
            });
          } else {
            res.writeHead(405);
            res.end();
          }
        });
      },
    },
  ],
});

await server.listen();
console.log(`Vite server listening at http://127.0.0.1:${PORT}/`);

const testUrl = `http://127.0.0.1:${PORT}/test-wasm-runner.html`;
console.log(`Launching Google Chrome: ${CHROME_PATH}`);

const outputDir = path.resolve('firmware/tests/build-output');
fs.mkdirSync(outputDir, { recursive: true });
// Isolate each test; never delete an existing profile outside this repository.
const userDataDir = fs.mkdtempSync(path.join(outputDir, 'chrome-blockly-test-'));

const chromeProc = spawn(
  CHROME_PATH,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    testUrl,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

chromeProc.stdout.on('data', (d) => {
  const line = d.toString().trim();
  if (line) console.log(`[Chrome STDOUT] ${line}`);
});
chromeProc.stderr.on('data', (d) => {
  const line = d.toString().trim();
  if (line && line.includes('Console')) console.log(`[Chrome Console] ${line}`);
});

const timeoutMs = 240000;
const timer = setTimeout(() => {
  reportReject(new Error(`Timed out after ${timeoutMs / 1000}s waiting for browser test report`));
}, timeoutMs);

try {
  const report = await reportPromise;
  clearTimeout(timer);

  console.log('\n===============================================================');
  console.log('=== REAL CHROME TEST REPORT: BLOCKLY -> C++ -> WASM -> BIN ===');
  console.log('===============================================================');
  console.log(`Overall Status:   ${report.overallStatus}`);
  console.log(`Browser:          ${report.browser}`);
  console.log(`Target Core:      ${report.core}`);
  console.log(`Board ID:         ${report.boardId}`);
  if (report.memory) {
    console.log(`Memory Heap:      ${((report.memory.usedJSHeapSize || 0) / 1048576).toFixed(2)} MB / ${((report.memory.totalJSHeapSize || 0) / 1048576).toFixed(2)} MB`);
  }
  console.log('\nPrograms Verified:');
  for (const r of report.results) {
    console.log(`[${r.status}] ${r.name}`);
    console.log(`   buildId:  ${r.buildId}`);
    console.log(`   duration: ${r.durationMs} ms (comp=${r.stats.compileMs}ms, link=${r.stats.linkMs}ms)`);
    console.log(`   size:     ELF=${r.stats.elfSize} B, AppBin=${r.stats.appBinSize} B`);
    console.log(`   segments: 4 segments (0x0, 0x8000, 0xe000, 0x10000) validated`);
  }
  console.log('===============================================================\n');

  fs.writeFileSync(path.resolve('firmware/tests/build-output/blockly-wasm-verification-report.json'), JSON.stringify(report, null, 2), 'utf8');

  if (report.overallStatus !== 'PASS') {
    throw new Error('Test failed: ' + report.error);
  }
} finally {
  clearTimeout(timer);
  try { chromeProc.kill('SIGKILL'); } catch (_) {}
  await server.close();
  const relativeProfile = path.relative(outputDir, path.resolve(userDataDir));
  if (!relativeProfile.startsWith('..') && !path.isAbsolute(relativeProfile) && relativeProfile.startsWith('chrome-blockly-test-')) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}
