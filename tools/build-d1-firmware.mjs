import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const fqbn = 'esp32-bluepad32:esp32:esp32';

export async function buildD1Firmware(execute, { mode, first, second }) {
  const sketch = fileURLToPath(new URL(mode === 'i2c' ? 'firmware/ps4_i2c_bridge' : 'firmware/demos/ps4_uart_bridge_d1', root));
  const library = fileURLToPath(new URL('firmware/libraries/CodeLabPs4I2C', root));
  const extraLibrary = process.env.CODELAB_PS4BLUEPAD32_LIBRARY;
  const flags = mode === 'i2c' ? `-DCODELAB_D1_SDA=${first} -DCODELAB_D1_SCL=${second}` : `-DUART_TX_PIN=${first} -DUART_RX_PIN=${second}`;
  const directory = await mkdtemp(join(tmpdir(), 'codelab-d1-'));
  const args = ['compile', '--fqbn', fqbn, '--build-path', directory, '--library', library, '--build-property', `compiler.cpp.extra_flags=${flags}`, sketch];
  if (extraLibrary) args.splice(-1, 0, '--library', extraLibrary);
  try {
    const core = await execute(['core', 'list', '--format', 'json']);
    if (!core.ok || !JSON.parse(core.output).platforms?.some((p) => p.id === 'esp32-bluepad32:esp32' && p.installed_version === '4.1.0')) {
      throw new Error('Cần Arduino CLI và core esp32-bluepad32:esp32@4.1.0 trên máy chạy CodeLab.');
    }
    const properties = await execute([...args.slice(0, -1), '--show-properties=expanded', sketch]);
    const platform = /^runtime\.platform\.path=(.+)\r?$/m.exec(properties.output)?.[1].trim();
    if (!properties.ok || !platform) throw new Error(properties.error || 'Không đọc được đường dẫn core Bluepad32.');
    const result = await execute(args, 360_000);
    if (!result.ok) {
      const detail = result.error || result.output;
      const message = /Illegal System DLL Relocation/i.test(detail)
        ? 'Windows không khởi chạy được trình biên dịch Xtensa (Illegal System DLL Relocation).'
        : 'Biên dịch D1 thất bại. Kiểm tra thư viện PS4Bluepad32 1.0.1 và core Bluepad32.';
      throw new Error(`${message}\n${detail.trim().slice(-3000)}`);
    }
    const prefix = join(directory, `${basename(sketch)}.ino`);
    const files = [[0x1000, `${prefix}.bootloader.bin`], [0x8000, `${prefix}.partitions.bin`],
      [0xe000, join(platform, 'tools', 'partitions', 'boot_app0.bin')], [0x10000, `${prefix}.bin`]];
    return await Promise.all(files.map(async ([address, path]) => ({ address, base64: (await readFile(path)).toString('base64') })));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
