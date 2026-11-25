"""Package a local Bluepad32 4.1.0 Arduino build for CodeLab's WASM D1 compiler."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import tarfile
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('arduino_build', type=Path, help='Successful default ESP32 Dev Module I2C bridge build')
    parser.add_argument('ps4_library_zip', type=Path, help='External PS4Bluepad32 1.0.1 archive')
    parser.add_argument('output', type=Path, help='Destination .tar.gz')
    args = parser.parse_args()
    build = args.arduino_build.resolve()
    options = json.loads((build / 'build.options.json').read_text())
    if options['fqbn'] != 'esp32-bluepad32:esp32:esp32' or options.get('customBuildProperties'):
        parser.error('Use the default Bluepad32 ESP32 Dev Module build configuration.')
    core = Path(options['hardwareFolders'].split(',')[0]).resolve()
    if core.name != '4.1.0' or 'esp32-bluepad32' not in core.parts:
        parser.error('Arduino build must use Bluepad32 4.1.0.')
    sdk = core / 'tools/sdk/esp32'
    commands = json.loads((build / 'compile_commands.json').read_text())
    sketch = next(entry['arguments'] for entry in commands if entry['file'].endswith('ps4_i2c_bridge.ino.cpp'))
    gcc = Path(sketch[0]).resolve().parent.parent
    target = gcc / 'xtensa-esp32-elf'
    gcc_lib = gcc / 'lib/gcc/xtensa-esp32-elf/8.4.0'
    platform = dict(line.split('=', 1) for line in (core / 'platform.txt').read_text(encoding='utf8').splitlines()
                    if line.startswith('compiler.c.elf.') and '=' in line)
    flags = []
    for flag in sketch:
        if flag.startswith('-D'):
            flags.append(flag)
        elif flag.startswith('-I') and Path(flag[2:]).resolve().is_relative_to(core):
            flags.append('-I/sdk/' + Path(flag[2:]).resolve().relative_to(core).as_posix())
    flags.extend(['-I/vendor/ps4', '-I/src', '-isystem', '/gcc/include/c++/8.4.0',
                  '-isystem', '/gcc/include/c++/8.4.0/xtensa-esp32-elf', '-isystem', '/clang/include', '-isystem', '/gcc/include'])
    ld = ['-L/sdk/tools/sdk/esp32/dio_qspi', '-L/sdk/tools/sdk/esp32/lib', '-L/sdk/tools/sdk/esp32/ld',
          '-L/gcc/lib', '-L/gcc/libgcc']
    for flag in platform['compiler.c.elf.flags.esp32'].split():
        if flag.startswith('-Wl,'):
            ld.extend(flag[4:].split(','))
        elif flag not in ('-mlongcalls', '-Wno-frame-address', '-fno-rtti', '-fno-lto'):
            ld.append(flag)
    ld.extend(['/gcc/lib/crt0.o', '/gcc/libgcc/crti.o', '/gcc/libgcc/crtbegin.o', '--start-group', '@SKETCH@',
               '/objects/Wire.o', '/objects/Preferences.o', '/objects/core.a',
               *dict.fromkeys(platform['compiler.c.elf.libs.esp32'].split()), '--end-group',
               '/gcc/libgcc/crtend.o', '/gcc/libgcc/crtn.o', '-EL', '-o', '/build/app.elf'])

    def append(tar, name, data):
        entry = tarfile.TarInfo(name)
        entry.size = len(data)
        tar.addfile(entry, io.BytesIO(data))

    def directory(tar, root, prefix, extensions):
        for path in sorted(root.rglob('*')):
            if path.is_file() and path.suffix in extensions:
                tar.add(path, arcname=f'{prefix}/{path.relative_to(root).as_posix()}', recursive=False)

    with zipfile.ZipFile(args.ps4_library_zip) as library:
        properties = library.read('ps4-esp32-lib-main/library.properties').decode()
        if not any(line.strip() == 'version=1.0.1' for line in properties.splitlines()):
            parser.error('Use PS4Bluepad32 version 1.0.1.')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('xb') as output, tarfile.open(fileobj=output, mode='w:gz', format=tarfile.GNU_FORMAT, compresslevel=1) as tar:
            append(tar, 'd1.json', json.dumps({'version': 1, 'core': '4.1.0', 'flags': flags, 'link': ld}).encode())
            for name in ['PS4Bluepad32.h', 'PS4Bluepad32.cpp']:
                append(tar, f'vendor/ps4/{name}', library.read(f'ps4-esp32-lib-main/src/{name}'))
            append(tar, 'vendor/ps4/LICENSE', library.read('ps4-esp32-lib-main/LICENSE'))
            clang = Path(__file__).resolve().parents[1] / 'public/toolchain-337'
            manifest = json.loads((clang / 'manifest.json').read_text())
            compressed = io.BytesIO(b''.join((clang / name).read_bytes() for name in manifest['sysrootChunks']))
            with tarfile.open(fileobj=compressed, mode='r:gz') as resources:
                prefix = 'sysroot/clang/lib/clang/20/include/'
                for entry in resources:
                    if entry.isfile() and entry.name.removeprefix('./').startswith(prefix):
                        append(tar, 'clang/include/' + entry.name.removeprefix('./')[len(prefix):], resources.extractfile(entry).read())
            for name in ['tools/sdk/esp32/include', 'tools/sdk/esp32/dio_qspi', 'tools/sdk/esp32/ld',
                         'tools/sdk/esp32/lib', 'cores/esp32', 'variants/esp32', 'libraries/Wire/src', 'libraries/Preferences/src']:
                directory(tar, core / name, 'sdk/' + name, {'.h', '.hpp', '.inc', '.ld', '.a'})
            directory(tar, target / 'include', 'gcc/include', {'', '.h', '.hpp', '.tcc'})
            for name in ['libc.a', 'libm.a', 'libstdc++.a', 'crt0.o']:
                tar.add(target / 'lib/no-rtti' / name if (target / 'lib/no-rtti' / name).exists() else target / 'lib' / name,
                        arcname='gcc/lib/' + name)
            for name in ['libgcc.a', 'crti.o', 'crtn.o', 'crtbegin.o', 'crtend.o']:
                tar.add(gcc_lib / 'no-rtti' / name, arcname='gcc/libgcc/' + name)
            core_archive = build / 'core/core.a'
            if not core_archive.is_file():
                cache = build.parent.parent / 'cores'
                candidates = sorted(cache.glob('esp32-bluepad32_esp32_esp32_*/core.a'))
                candidates = [p for p in candidates if 'DebugLevel' not in p.parent.name]
                if len(candidates) != 1:
                    parser.error('Copy the core.a from this build into its core/ directory.')
                core_archive = candidates[0]
            for name, path in [('core.a', core_archive), ('Wire.o', build / 'libraries/Wire/Wire.cpp.o'),
                               ('Preferences.o', build / 'libraries/Preferences/Preferences.cpp.o')]:
                tar.add(path, arcname='objects/' + name)
            for name, path in [('bootloader.bin', build / 'ps4_i2c_bridge.ino.bootloader.bin'),
                               ('partitions.bin', build / 'ps4_i2c_bridge.ino.partitions.bin'),
                               ('boot_app0.bin', core / 'tools/partitions/boot_app0.bin')]:
                tar.add(path, arcname='flash/' + name)
    with args.output.open('rb') as output:
        print(f'{args.output} {args.output.stat().st_size} bytes SHA-256 {hashlib.file_digest(output, "sha256").hexdigest()}')


if __name__ == '__main__':
    main()
