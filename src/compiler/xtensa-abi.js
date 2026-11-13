import { parseElf, SHF_ALLOC, SHT_INIT_ARRAY, SHT_PREINIT_ARRAY } from './elf.js';

// Core 3.3.7 sections.ld KEEP()s .ctors, not Clang's default .init_array.
// Without this option --gc-sections silently removes sketch constructors.
export const COMPILER_REVISION = 'xtensa-ctors-v1';
// The bundled Xtensa driver ignores the driver-level spelling; pass to cc1.
export const XTENSA_ABI_FLAGS = ['-Xclang', '-fno-use-init-array', '-g'];

export function validateConstructorAbi(objectBytes) {
  const orphan = parseElf(objectBytes).sections.find(s => s.size && (s.flags & SHF_ALLOC) &&
    (s.type === SHT_INIT_ARRAY || s.type === SHT_PREINIT_ARRAY));
  if (orphan) throw new Error(`Unsupported constructor section ${orphan.name}: Core 3.3.7 requires .ctors (-fno-use-init-array).`);
}
