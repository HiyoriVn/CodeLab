import { useCallback, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import BlocklyWorkspace from './components/BlocklyWorkspace.jsx';

const STORAGE_KEY = 'codelab.workspace.v1';
const FILE_TYPE = 'codelab-workspace';
const FILE_VERSION = 1;

function readWorkspace() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function App() {
  const workspaceRef = useRef(null);
  const fileInputRef = useRef(null);
  const [workspaceState, setWorkspaceState] = useState(readWorkspace);
  const [saveStatus, setSaveStatus] = useState('Bản nháp được lưu trên trình duyệt này');

  const handleWorkspaceChange = useCallback((state) => {
    setWorkspaceState(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveStatus('Đã tự lưu trên trình duyệt này');
    } catch {
      setSaveStatus('Không thể tự lưu — hãy tải tệp xuống máy');
    }
  }, []);

  const handleSaveFile = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const payload = {
      format: FILE_TYPE,
      version: FILE_VERSION,
      workspace: Blockly.serialization.workspaces.save(workspace),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codelab-workspace.codelab.json';
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus('Đã tải tệp workspace xuống');
  };

  const handleOpenFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.format !== FILE_TYPE || payload.version !== FILE_VERSION || !payload.workspace) {
        throw new Error('Tệp không đúng định dạng CodeLab hoặc chưa được hỗ trợ.');
      }
      const workspace = workspaceRef.current;
      if (!workspace) return;
      Blockly.serialization.workspaces.load(payload.workspace, workspace);
      setSaveStatus('Đã mở ' + file.name);
    } catch (error) {
      window.alert(error.message || 'Không thể mở tệp workspace.');
    }
  };

  const handleNewWorkspace = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    if (workspace.getAllBlocks(false).length && !window.confirm('Tạo workspace mới? Hãy tải tệp xuống trước nếu bạn muốn giữ bản hiện tại.')) return;
    workspace.clear();
    setSaveStatus('Workspace mới');
  };

  const handleLoadExample = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    if (workspace.getAllBlocks(false).length && !window.confirm('Nạp ví dụ sẽ thay workspace hiện tại. Bạn muốn tiếp tục?')) return;
    Blockly.serialization.workspaces.load({
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'controls_repeat_ext',
          inputs: {
            TIMES: { block: { type: 'math_number', fields: { NUM: 5 } } },
            DO: {
              block: {
                type: 'text_print',
                inputs: { TEXT: { block: { type: 'text', fields: { TEXT: 'Xin chào CodeLab!' } } } },
              },
            },
          },
        }],
      },
    }, workspace);
    setSaveStatus('Đã nạp workspace ví dụ');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="CodeLab trang chính">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span className="brand-copy"><strong>CodeLab</strong><small>Robotics Studio</small></span>
        </a>
        <div className="project-title">
          <span className="eyebrow">DỰ ÁN MỚI</span>
          <strong>Chương trình robot của tôi</strong>
        </div>
        <div className="topbar-actions">
          <span className="save-status"><i aria-hidden="true" />{saveStatus}</span>
          <button className="button button-quiet" onClick={handleLoadExample}>Nạp ví dụ</button>
          <button className="button button-quiet" onClick={handleNewWorkspace}>Workspace mới</button>
          <button className="button button-primary" onClick={handleSaveFile}>Tải workspace</button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,.codelab.json,application/json" onChange={handleOpenFile} />
          <button className="button button-quiet" onClick={() => fileInputRef.current?.click()}>Mở tệp</button>
        </div>
      </header>

      <section className="welcome-strip">
        <div>
          <span className="phase-tag">GIAI ĐOẠN 1 · WORKSPACE</span>
          <h1>Lắp ghép ý tưởng của bạn</h1>
          <p>Kéo các khối lệnh vào vùng làm việc. Workspace được tự lưu trên trình duyệt này.</p>
        </div>
        <div className="target-card">
          <span className="target-dot" />
          <span><small>MỤC TIÊU DỰ KIẾN</small><strong>ESP32-S3</strong></span>
          <span className="target-soon">SẮP CÓ</span>
        </div>
      </section>

      <section className="editor-frame" aria-label="Trình chỉnh sửa khối lệnh">
        <div className="editor-heading">
          <div><span className="editor-icon">▦</span><strong>Không gian lập trình</strong><span className="editor-divider">/</span><span className="editor-muted">Khối lệnh</span></div>
          <div className="editor-tools"><span className="keyboard-hint">Kéo thả để bắt đầu</span></div>
        </div>
        <BlocklyWorkspace initialState={workspaceState} onChange={handleWorkspaceChange} workspaceRef={workspaceRef} />
        <div className="workspace-footer">
          <span><i className="status-dot" />Sẵn sàng chỉnh sửa</span>
          <span>{workspaceState ? 'Có bản nháp được lưu' : 'Chưa có khối lệnh'}</span>
        </div>
      </section>

      <section className="next-step">
        <div className="next-step-icon" aria-hidden="true">⌘</div>
        <div><strong>Arduino C++ sẽ có ở giai đoạn tiếp theo</strong><p>Hiện tại CodeLab đang xây dựng workspace. Chưa có trình sinh mã, biên dịch hay nạp chương trình.</p></div>
        <span className="next-step-label">PHASE 2</span>
      </section>
      <footer className="page-footer"><span>CodeLab · Bản thử nghiệm ban đầu</span><span>Blockly workspace · ESP32-S3 dự kiến</span></footer>
    </main>
  );
}

export default App;
