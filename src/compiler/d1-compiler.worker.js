import { compileD1 } from './d1-compiler.js';
import i2c from '../../firmware/ps4_i2c_bridge/ps4_i2c_bridge.ino?raw';
import uart from '../../firmware/demos/ps4_uart_bridge_d1/ps4_uart_bridge_d1.ino?raw';
import frame from '../../firmware/libraries/CodeLabPs4I2C/src/I2CFrame.h?raw';
import mapping from '../../firmware/libraries/CodeLabPs4I2C/src/MappingPublisher.h?raw';
import gate from '../../firmware/libraries/CodeLabPs4I2C/src/ReportGate.h?raw';
import mac from '../../firmware/libraries/CodeLabPs4I2C/src/Ps4MacSerial.h?raw';

const sources = { i2c, uart, headers: { 'I2CFrame.h': frame, 'MappingPublisher.h': mapping, 'ReportGate.h': gate, 'Ps4MacSerial.h': mac } };

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không tải được ${url.pathname} (${response.status}).`);
  return response.arrayBuffer();
}

async function loadProgram(descriptor, baseUrl) {
  const chunks = await Promise.all((descriptor.chunks || [descriptor.url]).map((name) => download(new URL(name, baseUrl))));
  const program = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    program.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  return WebAssembly.compile(program);
}

self.onmessage = async ({ data: { config, toolchain } }) => {
  const progress = (message) => self.postMessage({ type: 'progress', message });
  try {
    if (!toolchain?.size || toolchain.size > 96 * 1024 ** 2) throw new Error('Chọn gói biên dịch D1 .tar.gz dưới 96 MiB.');
    progress('Đang tải trình biên dịch WebAssembly…');
    const url = new URL(`${import.meta.env.BASE_URL}toolchain-337/manifest.json`, self.location.origin);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Không tải được manifest trình biên dịch WebAssembly.');
    const { tools } = await response.json();
    const [clangMod, ldMod, bytes] = await Promise.all([
      loadProgram(tools.clang, url), loadProgram(tools.ld, url), toolchain.arrayBuffer(),
    ]);
    const { segments } = await compileD1({ config, sources, clangMod, ldMod, packageBytes: new Uint8Array(bytes), onProgress: progress });
    self.postMessage({ type: 'success', segments }, segments.map(({ data }) => data.buffer));
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
