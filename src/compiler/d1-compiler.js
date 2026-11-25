import { Vfs } from './vfs.js';
import { gunzip, untar } from './tar.js';
import { runWasi } from './wasi-runner.js';
import { elfToImage } from './esp-image.js';
import { verifyImage } from './inspect-firmware.js';
import { validateConstructorAbi } from './xtensa-abi.js';
import { validateD1Config } from '../device/d1-firmware-config.js';

export async function compileD1({ clangMod, ldMod, packageBytes, config, onProgress, sources }) {
  const { mode, first, second } = validateD1Config(config);
  if (packageBytes[0] !== 0x1f || packageBytes[1] !== 0x8b || packageBytes.byteLength > 96 * 1024 ** 2) {
    throw new Error('Chọn gói biên dịch D1 .tar.gz dưới 96 MiB.');
  }
  const vfs = new Vfs(untar(await gunzip(packageBytes, 300 * 1024 ** 2), { copy: false }));
  const options = JSON.parse(vfs.readText('d1.json') || 'null');
  if (options?.version !== 1 || options.core !== '4.1.0' || !Array.isArray(options.flags) || !Array.isArray(options.link)) {
    throw new Error('Gói biên dịch D1 không hợp lệ hoặc khác phiên bản Bluepad32 4.1.0.');
  }

  for (const [name, content] of Object.entries(sources.headers)) vfs.writeFile(`src/${name}`, content);
  vfs.writeFile('src/d1.cpp', sources[mode]);
  const pins = mode === 'i2c' ? [`-DCODELAB_D1_SDA=${first}`, `-DCODELAB_D1_SCL=${second}`] : [`-DUART_TX_PIN=${first}`, `-DUART_RX_PIN=${second}`];
  const flags = ['--target=xtensa-esp-elf', '-mcpu=esp32', '-Xclang', '-target-feature', '-Xclang', '+longcalls',
    '-I/sdk/tools/sdk/esp32/dio_qspi/include', '-std=gnu++11', '-fexceptions', '-fno-rtti',
    '-Os', '-ffunction-sections', '-fdata-sections', '-Xclang', '-fno-use-init-array', ...options.flags];
  onProgress?.('Đang biên dịch firmware D1…');
  const objects = [];
  for (const [source, output] of [['/src/d1.cpp', '/build/d1.o'], ['/vendor/ps4/PS4Bluepad32.cpp', '/build/ps4.o']]) {
    const result = await runWasi(clangMod, ['clang', ...flags, ...pins, '-c', source, '-o', output], vfs);
    if (result.exitCode) throw new Error(`Biên dịch D1 thất bại:\n${result.stderr || result.stdout}`);
    validateConstructorAbi(vfs.readFile(output));
    objects.push(output);
  }
  onProgress?.('Đang liên kết với Bluepad32…');
  const linked = await runWasi(ldMod, ['ld', ...options.link.flatMap((arg) => arg === '@SKETCH@' ? objects : [arg])], vfs);
  if (linked.exitCode) throw new Error(`Liên kết D1 thất bại:\n${linked.stderr || linked.stdout}`);
  const elf = vfs.readFile('build/app.elf');
  const app = await elfToImage(elf, { chip: 'ESP32', flashSize: '4MB', flashFreq: '80m', maxChipRevFull: 0xffff });
  await verifyImage(elf, app, { chip: 'ESP32' });
  const addresses = [0x1000, 0x8000, 0xe000, 0x10000];
  const data = ['bootloader.bin', 'partitions.bin', 'boot_app0.bin'].map((name) => vfs.readFile(`flash/${name}`));
  data.push(app);
  if (data.some((bytes) => !bytes?.length) || app.length > 0x140000) throw new Error('Firmware D1 thiếu phân đoạn hoặc vượt kích thước phân vùng.');
  return { segments: addresses.map((address, i) => ({ address, data: data[i].slice() })), elf };
}
