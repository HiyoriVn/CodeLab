import { useState } from 'react';

function CodePreview({ code, warnings }) {
  const [copyStatus, setCopyStatus] = useState('');

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('Đã sao chép');
    } catch {
      setCopyStatus('Không thể truy cập clipboard');
    }
    window.setTimeout(() => setCopyStatus(''), 1800);
  };

  return (
    <section className="code-panel" aria-label="Mã Arduino C++ được sinh">
      <header className="code-panel-header">
        <div>
          <span className="code-panel-icon" aria-hidden="true">{ }</span>
          <strong>Mã Arduino C++</strong>
          <span className="code-language">ESP32-S3 · bản xem trước</span>
        </div>
        <button className="button button-quiet" onClick={copyCode}>{copyStatus || 'Sao chép mã'}</button>
      </header>
      {warnings.length > 0 && (
        <div className="generator-warning" role="status">
          <strong>Mã chưa hoàn chỉnh.</strong> {warnings.join(' ')} Không dùng để nạp lên bo mạch.
        </div>
      )}
      <pre className="code-output"><code>{code || '// Đang tạo mã…'}</code></pre>
    </section>
  );
}

export default CodePreview;
