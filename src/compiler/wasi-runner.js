import { ConsoleStdout, File, OpenFile, PreopenDirectory, WASI, WASIProcExit } from '@bjorn3/browser_wasi_shim';

export async function runWasi(module, argv, vfs) {
  const stdout = [];
  const stderr = [];
  const fds = [
    new OpenFile(new File([])), // stdin
    ConsoleStdout.lineBuffered((l) => stdout.push(l)),
    ConsoleStdout.lineBuffered((l) => stderr.push(l)),
    new PreopenDirectory('/', vfs.root),
  ];
  const wasi = new WASI(argv, ['PWD=/', 'HOME=/tmp', 'TMPDIR=/tmp'], fds, { debug: false });
  const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });

  let exitCode = 0;
  try {
    exitCode = wasi.start(instance);
  } catch (e) {
    if (e instanceof WASIProcExit) exitCode = e.code;
    else throw e;
  }
  return { exitCode, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}
