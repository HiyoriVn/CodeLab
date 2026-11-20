import { useMemo, useState } from 'react';
import { highlightCpp } from '../ui/highlight.js';
import { previewCpp } from '../ui/learning-code.js';

function CodePreview({ code, warnings, logic = '' }) {
  const [copyStatus, setCopyStatus] = useState('');
  const [mode, setMode] = useState('logic');

  const displayed = mode === 'logic' ? logic : previewCpp(code);
  const highlighted = useMemo(() => mode === 'cpp' ? highlightCpp(displayed) : displayed, [displayed, mode]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayed);
      setCopyStatus('Đã sao chép');
    } catch {
      setCopyStatus('Không thể truy cập clipboard');
    }
    window.setTimeout(() => setCopyStatus(''), 1800);
  };

  return (
    <section className="code-panel" aria-label="Mã nguồn chương trình">
      <div className="code-panel-header">
        <select aria-label="Chế độ xem mã nguồn" value={mode} onChange={event => setMode(event.target.value)}>
          <option value="logic">Logic chương trình</option>
          <option value="cpp">Arduino C++ đầy đủ</option>
        </select>
        <button className="button button-quiet" onClick={copyCode}>{copyStatus || 'Sao chép mã'}</button>
      </div>
      {warnings.length > 0 && (
        <div className="generator-warning" role="status">
          <strong>Mã chưa hoàn chỉnh.</strong> {warnings.join(' ')} Không dùng để nạp lên bo mạch.
        </div>
      )}
      <pre className="code-output"><code>{displayed ? highlighted : <span className="tok-comment">Chưa có mã nguồn.</span>}</code></pre>
    </section>
  );
}

export default CodePreview;
