import { FAST4WD_BOARD_ID, isNewmaniaBoard } from '../boards/profiles.js';

let sharedWorker = null;
let nextRequestId = 1;

function getWorker() {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('./browser-compiler.worker.js', import.meta.url), {
      type: 'module',
    });
  }
  return sharedWorker;
}

export function compileInBrowser(code, boardId = FAST4WD_BOARD_ID, { onProgress, toolchainUrl } = {}) {
  return new Promise((resolve, reject) => {
    if (!isNewmaniaBoard(boardId)) {
      return reject(new Error(`Trình biên dịch trình duyệt chỉ hỗ trợ Newmania V1/V2 (Core 3.3.7).`));
    }
    if (!code || typeof code !== 'string') {
      return reject(new Error('Mã nguồn C++ không được để trống.'));
    }

    const worker = getWorker();
    const requestId = nextRequestId++;

    const cleanup = () => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
    };

    const handler = (ev) => {
      const data = ev.data;
      if (!data) return;
      if (data.requestId !== undefined && data.requestId !== requestId) return;

      if (data.type === 'progress') {
        onProgress?.(data.message);
      } else if (data.type === 'done') {
        cleanup();
        resolve(data);
      } else if (data.type === 'error') {
        cleanup();
        reject(new Error(data.error || 'Biên dịch thất bại'));
      }
    };

    const errorHandler = (err) => {
      cleanup();
      if (sharedWorker === worker) sharedWorker = null;
      reject(new Error(err?.message || 'Lỗi trong Web Worker'));
    };

    worker.addEventListener('message', handler);
    worker.addEventListener('error', errorHandler);

    worker.postMessage({
      action: 'compile',
      requestId,
      code,
      boardId,
      toolchainUrl,
    });
  });
}
