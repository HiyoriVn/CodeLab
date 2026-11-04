import { useMemo, useState } from 'react';
import { highlightCpp } from '../ui/highlight.js';

function CodePreview({ code, warnings }) {
  const [copyStatus, setCopyStatus] = useState('');

  const highlighted = useMemo(() => highlightCpp(code || ''), [code]);

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
      <div className="code-panel-header">
        <span className="code-language">Arduino C++ · ESP32-S3 · bản xem trước</span>
        <button className="button button-quiet" onClick={copyCode}>{copyStatus || 'Sao chép mã'}</button>
      </div>
      {warnings.length > 0 && (
        <div className="generator-warning" role="status">
          <strong>Mã chưa hoàn chỉnh.</strong> {warnings.join(' ')} Không dùng để nạp lên bo mạch.
        </div>
      )}
      <pre className="code-output"><code>{code ? highlighted : <span className="tok-comment">// Đang tạo mã…</span>}</code></pre>
    </section>
  );
}

export default CodePreview;
