import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const HOST = '127.0.0.1';
const PORT = Number(process.env.CODELAB_BRIDGE_PORT || 8787);
const FQBN = process.env.CODELAB_FQBN || 'esp32:esp32:esp32s3';
const CLI = process.env.ARDUINO_CLI_PATH || 'arduino-cli';
const MAX_BODY = 1_000_000;
const DIST = resolve('dist');
const builds = new Map();

function run(args, timeout = 180_000) {
  return new Promise((resolveRun) => {
    const child = spawn(CLI, args, { windowsHide: true, shell: false });
    let output = '';
    let error = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, code: -1, output, error: 'Quá thời gian chờ Arduino CLI.' });
    }, timeout);
    child.stdout.setEncoding('utf8').on('data', (part) => { output += part; });
    child.stderr.setEncoding('utf8').on('data', (part) => { error += part; });
    child.on('error', (cause) => finish({ ok: false, code: -1, output, error: cause.message }));
    child.on('close', (code) => finish({ ok: code === 0, code, output, error }));
  });
}

function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function bodyJson(req) {
  let raw = '';
  for await (const part of req) {
    raw += part;
    if (raw.length > MAX_BODY) throw new Error('Yêu cầu vượt giới hạn 1 MB.');
  }
  return JSON.parse(raw || '{}');
}

function getPorts(result) {
  try {
    const data = JSON.parse(result.output);
    const rows = data.detected_ports || data.ports || [];
    return rows.map((row) => {
      const address = row.port?.address || row.address;
      return address ? { address, label: row.port?.label || row.label || address } : null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:(5173|4173|8787))?$/.test(origin)) {
    return send(res, 403, { error: 'Chỉ chấp nhận yêu cầu từ ứng dụng CodeLab cục bộ.' });
  }
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const result = await run(['version'], 15_000);
      return send(res, 200, { ready: result.ok, fqbn: FQBN, version: result.output.trim(), error: result.error });
    }
    if (req.method === 'GET' && url.pathname === '/api/ports') {
      const result = await run(['board', 'list', '--format', 'json'], 20_000);
      return send(res, result.ok ? 200 : 500, { ports: getPorts(result), error: result.error });
    }
    if (req.method === 'POST' && url.pathname === '/api/compile') {
      const payload = await bodyJson(req);
      if (typeof payload.code !== 'string' || !payload.code.trim() || payload.code.length > MAX_BODY) {
        return send(res, 400, { error: 'Mã nguồn trống hoặc vượt giới hạn.' });
      }
      if (payload.warnings?.length) return send(res, 400, { error: 'Còn cảnh báo trong mã sinh; hãy xử lý trước khi biên dịch.' });
      const directory = await mkdtemp(join(tmpdir(), 'codelab-'));
      const sketch = join(directory, 'CodeLabSketch');
      const outputDir = join(directory, 'build');
      await mkdir(sketch);
      await mkdir(outputDir);
      await writeFile(join(sketch, 'CodeLabSketch.ino'), payload.code, 'utf8');
      const result = await run(['compile', '--fqbn', FQBN, '--output-dir', outputDir, sketch]);
      if (!result.ok) {
        await rm(directory, { recursive: true, force: true });
        return send(res, 422, { ok: false, output: result.output, error: result.error });
      }
      const id = randomUUID();
      builds.set(id, { directory, sketch, outputDir, createdAt: Date.now() });
      return send(res, 200, { ok: true, buildId: id, output: result.output, error: result.error });
    }
    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const payload = await bodyJson(req);
      if (payload.confirmed !== true) return send(res, 400, { error: 'Cần xác nhận nạp firmware.' });
      const build = builds.get(payload.buildId);
      if (!build) return send(res, 410, { error: 'Bản biên dịch đã hết hạn; hãy biên dịch lại.' });
      const list = await run(['board', 'list', '--format', 'json'], 20_000);
      const ports = getPorts(list);
      if (!ports.some((port) => port.address === payload.port)) {
        return send(res, 400, { error: 'Cổng đã chọn không còn được Arduino CLI nhận diện.' });
      }
      const result = await run(['upload', '--fqbn', FQBN, '--port', payload.port, '--input-dir', build.outputDir, build.sketch], 240_000);
      return send(res, result.ok ? 200 : 422, { ok: result.ok, output: result.output, error: result.error });
    }
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const file = resolve(DIST, requested);
      if (file !== DIST && !file.startsWith(DIST + sep)) return send(res, 403, { error: 'Đường dẫn không hợp lệ.' });
      try {
        const bytes = await readFile(file);
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
        res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=3600' });
        return res.end(bytes);
      } catch {
        return send(res, 503, { error: 'Chưa có bản web. Chạy npm run build trước.' });
      }
    }
    return send(res, 404, { error: 'Không tìm thấy API.' });
  } catch (error) {
    return send(res, 400, { error: error.message || 'Yêu cầu không hợp lệ.' });
  }
});

setInterval(async () => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, build] of builds) {
    if (build.createdAt < cutoff) {
      builds.delete(id);
      await rm(build.directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}, 60_000).unref();

server.listen(PORT, HOST, () => {
  process.stdout.write(`CodeLab Arduino bridge: http://${HOST}:${PORT}\nTarget: ${FQBN}\n`);
});
