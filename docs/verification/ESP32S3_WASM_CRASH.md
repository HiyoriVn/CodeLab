# ESP32-S3 WASM startup crash — 2026-11-14

Branch: `test/integration-ui-wasm-newmania`, starting HEAD `c344dfb`.
Software diagnosis and correction only; no flash, hardware run, commit, push or deploy.

## Finding and evidence

The browser compiler used Clang's default `.init_array` for dynamic global
initialization. The bundled Core 3.3.7 `sections.ld` instead retains only
`.ctors`/`.ctors.*` between `__init_array_start` and `__init_array_end`.
`--gc-sections` discarded the sketch's initializer. This is a compiler/linker
constructor ABI mismatch, before ELF-to-image conversion or USB transport.

The generated `static Board newmania(...)` lives in zero-initialized storage.
Its dynamic constructor must initialize nested objects, virtual tables and
references, including `SingleMotor::io_`. Without that constructor,
`Board.begin()` reaches `Robot.begin()` → `QuadMotors.begin()` →
`SingleMotor<1>::begin()`, which calls `io_.begin(...)` through an uninitialized
reference. This explains the null-address LoadProhibited failure.

Serial Counter still uses the shared `Board.begin()`: I2C and motor backend
initialization happen before student Serial/Wait statements. A PS4 block is not
required to reach this failure. The scheduler and student callback have not
started. No change to motor direction, GPIO, servo behavior or PS4 logic is
needed to correct this constructor ABI defect.

Three real WASM compilations of a small global-constructor probe confirmed:

| Compiler options | Object section | Outcome with the actual ABI guard |
| --- | --- | --- |
| Original options | `.init_array` | Rejected |
| Driver-level `-fno-use-init-array` | `.init_array`; unused argument warning | Rejected |
| `-Xclang -fno-use-init-array` | `.ctors` | Accepted |

The direct driver spelling is ignored by this bundled Xtensa Clang. The fix
passes the option to cc1 for sketch and library compilation. A post-compile
object check rejects unsupported initializer sections before linker garbage
collection can hide them. Compiler revision participates in object-cache keys
and build identity.

## Backtrace reconstruction

Rebuilt the pre-Servo source and library payload from `8c011c9` without checking
out or changing the working branch. Both original BIN sizes from the previous
verification record were reproduced: **344432** and **346304** bytes. All 14
supplied addresses fall inside the expected function ranges in these ELFs:

| Bài 01 PC | Bài 05 PC | Resolved function |
| --- | --- | --- |
| `0x4202399f` | `0x420240fb` | `codelab::motor_test::SingleMotor<1u>::begin()` + 7 |
| `0x42002b82` | `0x42003306` | `QuadMotors::begin()` + 46 |
| `0x42002b2a` | `0x420032ae` | `codelab::fast4wd::Robot::begin(bool)` + 102 |
| `0x4200228a` | `0x420022aa` | `codelab::newmania::Board::begin(...)` + 62 |
| `0x42002218` | `0x42002238` | `setup()` + 20 |
| `0x42008565` | `0x42008d35` | `loopTask(void*)` + 33 |
| `0x4037c17d` | `0x4037c17d` | `vPortTaskWrapper` + 5 |

These reconstructed ELFs strongly match the crash, but an exact ELF hash from
the device was not supplied, so byte identity with the flashed firmware cannot
be proven. Do not decode these old PCs using the newly fixed ELF: addresses move.

The original sketch/library objects had no DWARF. Function names were resolved
with the installed `llvm-addr2line`; source lines report `??:0`. Xtensa vendor
`addr2line` cannot start in this environment because of Windows DLL relocation
errors. Reading `SingleMotor.h` identifies the relevant `io_.begin(...)` call;
that is source inspection, not a recovered DWARF line for the old PC.

New builds use `-g`. LLVM addr2line successfully resolved the newly compiled
`SingleMotor<1>::begin()` entry to `/libs/CodeLabFast4wd/src/SingleMotor.h:26`
for both fixed ELFs. This establishes debug-information availability, not device
execution.

## ELF, image, memory and flash checks

Both historical ELFs have 12 startup-table entries and no sketch initializer.
Both fixed ELFs have 13 entries, including `_GLOBAL__sub_I_sketch.ino`.
The fixed table contains its function address; the previously discarded backend
code, including `mcpwm_init`, is retained as well.

| Source snapshot / pipeline | Bài 01 app BIN | Bài 05 app BIN |
| --- | ---: | ---: |
| Pre-Servo `8c011c9`, original WASM options | 344432 | 346304 |
| Current `c344dfb`, original WASM options | 346224 | 348112 |
| Current source, corrected constructor ABI | 355648 | 357552 |
| Same current source via Arduino CLI Core 3.3.7 | Blocked before GCC execution | Blocked before GCC execution |

Detailed verifier results for both fixed builds:

- ESP magic `0xe9`, chip ID 9 and BIN entry equal to ELF entry.
- Entry `0x40375bc0` lies in the IRAM startup region. Historical entry was
  `0x40375ba8`; relinking changed it, and the image follows the ELF value.
- Every nonempty allocated, file-backed ELF section is represented by matching
  bytes in the image, including `.dram0.data`, vectors, IRAM, flash code, app
  descriptor and rodata containing the constructor table.
- Flash data offsets have the same low 16 bits as their mapped IROM/DROM
  addresses, preserving 64 KiB MMU alignment. RAM split across alignment filler
  segments is compared byte for byte too.
- `.dram0.bss` is `SHT_NOBITS`: it is not serialized as initialized image data.
  ELF parsing now correctly exposes empty file data for NOBITS. Startup remains
  the existing Core code; no custom BSS/data initializer was introduced.
- Fixed BSS boundaries: Serial `0x3fc98880..0x3fc9d878`, joystick
  `0x3fc98880..0x3fc9d8b0`. No profile, memory map, linker script, PSRAM or
  partition configuration was changed.
- Segment checksum and appended SHA-256 pass independent decoding. Historical
  images pass the same payload/alignment/checksum checks, showing that a valid
  ESP image alone does not establish correct C++ startup.
- `elfToImage` now embeds SHA-256 of the exact ELF in the app descriptor's
  existing digest field, matching esptool's convention. It operates on a copy,
  recalculates the image checksum/digest, and leaves the exported ELF unchanged.
- Flash packaging still uses `0x0/0x8000/0xe000/0x10000`, existing bootloader,
  partition table, boot_app0 and FQBN. Existing USB transport still verifies
  segment hashes by readback. No live USB transport was used in this task.

The preserved FQBN is:

```text
esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=default_8MB,PSRAM=disabled,USBMode=hwcdc,CDCOnBoot=cdc
```

## Exporting the ELF from the actual web build

After a browser compilation succeeds, expand **Debug firmware** in the device
dialog. **Tải app.elf** downloads the exact linked bytes that produced that
build's app BIN, with a build-specific filename. **Tải thông tin debug** exports
ELF/app hashes, build ID, compiler/library revision, FQBN, firmware manifest,
stats and the exact preprocessed sketch source with prototype/#line additions.
No second compilation is performed during export. Exports are disabled when
source/board no longer matches the displayed build, and while a device operation
is busy. Save both files before closing the dialog or recompiling; there is no
automatic durable build history.

To resolve a later crash, use that build's saved ELF:

```powershell
xtensa-esp32s3-elf-addr2line -pfiaC -e .\BUILD_ID.elf 0xPC1 0xPC2
```

Compare the ELF SHA-256 with the exported metadata and, when present, the panic
log's ELF hash prefix. A rebuilt ELF of a different source/compiler revision is
not an interchangeable symbol file.

## Checks run and limitations

| Check | Observed result |
| --- | --- |
| `node tools/verify-browser-crash.mjs` | PASS: both actual WASM links, sketch initializer in startup table, DWARF present, image payload/entry/MMU/checksum/SHA verified |
| Focused ABI/image/React device tests | **4/4 PASS**, including real Clang negative/positive probes and exact ELF download/stale-build rejection |
| `npm test` | **138/147 PASS, 9 FAIL**: six bridge HTTP tests blocked by localhost `EACCES`; three unchanged catalog/toolbox expectations disagree with existing Servo entries (7 vs 8 groups, 44 vs 46 entries) |
| `npm run build` | PASS; existing large-chunk warning |
| `git diff --check` | PASS |
| Headless Chrome browser runner | No acceptance result; browser could not deliver a report through localhost. Vite also reported dependency scanning an old ignored Chrome profile. Run was stopped; no Chrome PASS claimed |
| Arduino CLI 1.5.1 / Core 3.3.7, both same-source builds | Both exit 1: `xtensa-esp32s3-elf-g++.exe` fails with `Illegal System DLL Relocation` |
| Flash, hardware boot, I2C, MCPWM waveforms, motors/servo/PS4 | Not performed |

The requested same-program GCC-vs-WASM ELF/BIN comparison remains incomplete
because the existing native toolchain cannot execute. A compile PASS, the old
CLI size records or a different GCC version were not substituted for that test.
No toolchain was installed or updated. To finish, rerun the same sketches with
the preserved FQBN and `--libraries firmware/libraries` on a working Core 3.3.7
installation, preserve each build directory, then compare ELF startup tables,
memory sections and image payloads. Binary equality is not expected across GCC
and Clang; constructor execution, memory layout and observed runtime behavior
are the relevant checks.

This work fixes a demonstrated compiler ABI defect. A successful boot and
absence of additional hardware-dependent defects remain unconfirmed until the
owner runs the fixed firmware on the actual board.

## Changed files

| File | Reason |
| --- | --- |
| `src/compiler/xtensa-abi.js` | Shared cc1 ABI/debug flags, revision, constructor-section guard |
| `src/compiler/browser-compiler.worker.js` | Apply/validate ABI for all compiled objects; invalidate cache/build ID; return exact ELF and hashes |
| `src/compiler/elf.js` | Correct NOBITS file-data representation |
| `src/compiler/esp-image.js` | Embed exact ELF hash in existing app descriptor without mutating ELF |
| `src/compiler/debug-artifacts.js` | Download exact ELF and debug metadata |
| `src/components/DevicePanel.jsx` | Collapsed debug download controls |
| `src/compiler/inspect-firmware.js` | ELF symbols/startup inspection and independent image/ELF checks |
| `tools/verify-browser-crash.mjs` | Reproducible compile-only verification and local evidence capture |
| `tests/browser-compiler-abi.test.mjs` | Actual bundled WASM constructor regression, including ignored driver flag |
| `tests/esp-image.test.mjs` | BSS/data/entry/MMU/digests/ELF immutability and corruption rejection |
| `tests/device-operation-ui.test.mjs` | Downloaded ELF bytes/metadata and stale-build guard |
| `docs/TESTING.md`, this report | Actual evidence, remaining gates and debug workflow |

No runtime library, generator, board-profile, GPIO, motor/servo/PS4 driver or
Blockly structure was changed.

## Local evidence

Ignored, reproducible build outputs under `firmware/tests/build-output/crash-audit/`:
`verified/report.json`, per-lesson `app.elf`, `app.bin`, `debug.json`;
`historical-*/inspection.json`, `image-check.json`, `addr2line.txt`;
`historical-sketch.s`, `cli-serial.log`, `cli-joystick.log`, `npm-test.log`,
`focused.log`, `build.log`, `chrome.log`.

Official reference behavior:
[Clang options](https://clang.llvm.org/docs/ClangCommandLineReference.html),
[esptool ELF conversion](https://github.com/espressif/esptool/blob/master/esptool/cmds.py),
[esptool image digest insertion](https://github.com/espressif/esptool/blob/master/esptool/bin_image.py).
The diagnosis above relies on the bundled compiler/linker and rebuilt ELF
evidence, rather than assuming current upstream defaults.
