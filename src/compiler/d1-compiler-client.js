export function compileD1InBrowser(toolchain, config, progress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./d1-compiler.worker.js', import.meta.url), { type: 'module' });
    const finish = (callback, value) => {
      clearTimeout(timeout);
      worker.terminate();
      callback(value);
    };
    const timeout = setTimeout(() => finish(reject, new Error('Quá thời gian biên dịch D1.')), 180_000);
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') progress(data.message);
      if (data.type === 'success') finish(resolve, data.segments);
      if (data.type === 'error') finish(reject, new Error(data.message));
    };
    worker.onerror = (error) => finish(reject, new Error(error.message || 'Không khởi chạy được trình biên dịch D1.'));
    worker.postMessage({ config, toolchain });
  });
}
