import { FAST4WD_BOARD_ID } from '../boards/profiles.js';

let sharedWorker = null;

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
    if (boardId !== FAST4WD_BOARD_ID) {
      return reject(new Error(`Trình biên dịch trình duyệt chỉ hỗ trợ ${FAST4WD_BOARD_ID} (Core 3.3.7).`));
    }
    if (!code || typeof code !== 'string') {
      return reject(new Error('Mã nguồn C++ không được để trống.'));
    }

    const worker = getWorker();

    const handler = (ev) => {
      const data = ev.data;
      if (!data) return;

      if (data.type === 'progress') {
        onProgress?.(data.message);
      } else if (data.type === 'done') {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errorHandler);
        resolve(data);
      } else if (data.type === 'error') {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errorHandler);
        reject(new Error(data.error || 'Biên dịch thất bại'));
      }
    };

    const errorHandler = (err) => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
      reject(new Error(err?.message || 'Lỗi trong Web Worker'));
    };

    worker.addEventListener('message', handler);
    worker.addEventListener('error', errorHandler);

    worker.postMessage({
      action: 'compile',
      code,
      boardId,
      toolchainUrl,
    });
  });
}
