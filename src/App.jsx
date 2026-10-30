import { useCallback, useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import BlocklyWorkspace from './components/BlocklyWorkspace.jsx';
import CodePreview from './components/CodePreview.jsx';
import DevicePanel from './components/DevicePanel.jsx';
import SerialMonitor from './components/SerialMonitor.jsx';
import TopBar from './ui/TopBar.jsx';
import Modal from './ui/Modal.jsx';
import ZoomControls from './ui/ZoomControls.jsx';
import { applyBar, readBar, readTheme, saveBar, saveTheme } from './ui/prefs.js';

const STORAGE_KEY = 'codelab.projects.v1';
const LEGACY_KEY = 'codelab.workspace.v1';
const FILE_TYPE = 'codelab-project';
const FILE_VERSION = 1;
const emptyWorkspace = { blocks: { languageVersion: 0, blocks: [] } };
function makeProject(name = 'Dự án mới', workspace = emptyWorkspace) {
  return { id: crypto.randomUUID(), name, workspace, updatedAt: new Date().toISOString() };
}
function readProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.projects?.length) return saved;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    const project = makeProject('Chương trình robot của tôi', legacy || emptyWorkspace);
    return { activeId: project.id, projects: [project] };
  } catch {
    const project = makeProject('Chương trình robot của tôi');
    return { activeId: project.id, projects: [project] };
  }
}
function App() {
  const workspaceRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(0);
  const [projectStore, setProjectStore] = useState(readProjects);
  const [generatedCode, setGeneratedCode] = useState({ code: '', warnings: [] });
  const [blockCount, setBlockCount] = useState(0);
  const [codeOpen, setCodeOpen] = useState(() => window.innerWidth >= 900);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(() => Math.round(Math.min(300, window.innerHeight * 0.42)));
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState(readTheme);
  const [barColor, setBarColor] = useState(readBar);
  const project = projectStore.projects.find((item) => item.id === projectStore.activeId) || projectStore.projects[0];

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { applyBar(barColor); }, [barColor]);
  const changeTheme = (value) => { setTheme(value); saveTheme(value); };
  const changeBar = (value) => { setBarColor(value); saveBar(value); };

  const store = useCallback((next) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { showToast('Không đủ chỗ lưu — hãy tải dự án xuống máy'); }
  }, [showToast]);
  const persist = useCallback((next) => { setProjectStore(next); store(next); }, [store]);
  const handleWorkspaceChange = useCallback((workspace) => {
    setProjectStore((current) => {
      const next = { ...current, projects: current.projects.map((item) => item.id === current.activeId ? { ...item, workspace, updatedAt: new Date().toISOString() } : item) };
      store(next);
      return next;
    });
  }, [store]);
  const handleCodeChange = useCallback((result) => {
    setGeneratedCode(result);
    setBlockCount(workspaceRef.current?.getAllBlocks(false).length || 0);
  }, []);

  const createProject = () => {
    const nextProject = makeProject();
    persist({ activeId: nextProject.id, projects: [...projectStore.projects, nextProject] });
    workspaceRef.current?.clear(); setDialog(null); showToast('Đã tạo dự án mới');
  };
  const renameProject = (event) => {
    const name = event.target.value;
    setProjectStore((current) => ({ ...current, projects: current.projects.map((item) => item.id === current.activeId ? { ...item, name } : item) }));
  };
  const saveProjectFile = () => {
    const state = workspaceRef.current ? Blockly.serialization.workspaces.save(workspaceRef.current) : project.workspace;
    const payload = { format: FILE_TYPE, version: FILE_VERSION, project: { name: project.name, workspace: state } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${project.name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'codelab-project'}.codelab.json`; link.click(); URL.revokeObjectURL(url);
    showToast('Đã tải tệp dự án xuống');
  };
  const pickProjectFile = () => { setDialog(null); fileInputRef.current?.click(); };
  const openProjectFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const content = payload.format === FILE_TYPE && payload.version === FILE_VERSION ? payload.project : payload.format === 'codelab-workspace' && payload.version === 1 ? { name: file.name.replace(/\.codelab\.json$|\.json$/i, ''), workspace: payload.workspace } : null;
      if (!content?.workspace) throw new Error('Tệp không đúng định dạng hoặc phiên bản chưa được hỗ trợ.');
      const imported = makeProject(content.name || file.name, content.workspace);
      persist({ activeId: imported.id, projects: [...projectStore.projects, imported] });
      if (workspaceRef.current) Blockly.serialization.workspaces.load(imported.workspace, workspaceRef.current);
      showToast(`Đã mở ${file.name}`);
    } catch (error) { window.alert(error.message || 'Không thể mở dự án.'); }
  };
  const closeDialog = useCallback(() => setDialog(null), []);

  const openDevice = () => { setTerminalOpen(false); setCodeOpen(false); setDialog('connect'); };
  const toggleTerminal = () => {
    const next = !terminalOpen;
    setTerminalOpen(next);
    if (next) { setCodeOpen(false); setDialog(null); }
  };
  const toggleCode = () => {
    const next = !codeOpen;
    setCodeOpen(next);
    if (next) { setTerminalOpen(false); setDialog(null); }
  };

  const CONSOLE_MIN = 44;
  const clampConsole = (value) => Math.max(CONSOLE_MIN, Math.min(value, window.innerHeight - 56 - 120));
  const startResize = (event) => {
    event.preventDefault();
    const startY = event.clientY; const startHeight = consoleHeight;
    const target = event.currentTarget; target.setPointerCapture?.(event.pointerId);
    const move = (e) => setConsoleHeight(clampConsole(startHeight + (startY - e.clientY)));
    const stop = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', stop); target.removeEventListener('pointercancel', stop); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', stop); target.addEventListener('pointercancel', stop);
  };
  const resizeByKey = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setConsoleHeight((h) => clampConsole(h - 24)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setConsoleHeight((h) => clampConsole(h + 24)); }
  };
  const toggleConsoleSize = () => setConsoleHeight((h) => (h <= CONSOLE_MIN + 4 ? clampConsole(300) : CONSOLE_MIN));

  return (
    <div className="app">
      <TopBar
        projectName={project?.name || ''} onRename={renameProject} onRenameCommit={() => persist(projectStore)}
        onNew={createProject} onOpenFile={pickProjectFile} onSave={saveProjectFile}
        onHelp={() => setDialog('help')} onConnect={openDevice}
        onToggleTerminal={toggleTerminal} onToggleCode={toggleCode}
        terminalOpen={terminalOpen} codeOpen={codeOpen}
        theme={theme} onTheme={changeTheme} barColor={barColor} onBarColor={changeBar}
        onLanguage={() => showToast('Chưa có bản dịch, hiện chỉ có Tiếng Việt')}
      />
      <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,.codelab.json,application/json" onChange={openProjectFile} />
      <div className="main">
        <div className="ws" aria-label="Trình chỉnh sửa khối lệnh">
          <BlocklyWorkspace key={project?.id} initialState={project?.workspace} dark={theme === 'dark'} onChange={handleWorkspaceChange} onCodeChange={handleCodeChange} workspaceRef={workspaceRef} />
          <ZoomControls workspaceRef={workspaceRef} />
          <div className="workspace-status"><span><i className="status-dot" />Sẵn sàng chỉnh sửa</span><span>{blockCount} khối đang dùng</span></div>
        </div>
        {codeOpen && (
          <aside className="code-side" aria-label="Mã được sinh">
            <h2>Code<button className="x" onClick={() => setCodeOpen(false)} aria-label="Đóng">×</button></h2>
            <CodePreview code={generatedCode.code} warnings={generatedCode.warnings} />
          </aside>
        )}
      </div>
      <section className="console" hidden={!terminalOpen} aria-label="Bảng lệnh" style={{ '--console-h': `${consoleHeight}px` }}>
        <div className="console-grip" role="separator" aria-orientation="horizontal" aria-label="Kéo để đổi kích thước bảng lệnh" aria-valuemin={CONSOLE_MIN} aria-valuenow={consoleHeight} tabIndex={0} title="Kéo xuống để thu nhỏ, kéo lên để phóng to" onPointerDown={startResize} onKeyDown={resizeByKey} onDoubleClick={toggleConsoleSize} />
        <h2>Bảng lệnh<button className="x" onClick={() => setTerminalOpen(false)} aria-label="Đóng">×</button></h2>
        <SerialMonitor />
      </section>

      <Modal open={dialog === 'help'} onClose={closeDialog} title="Hướng dẫn nhanh">
        <ol>
          <li>Chọn nhóm block ở cột bên trái.</li>
          <li>Kéo khối vào vùng làm việc; kéo khối vào cột bên trái để xóa.</li>
          <li>Thả khối gần đáy khối khác để nối thành chuỗi.</li>
          <li>Bấm nút code để xem code text.</li>
        </ol>
        <button className="btn p" onClick={closeDialog}>Đã hiểu</button>
      </Modal>
      <Modal open={dialog === 'connect'} onClose={closeDialog} title="Kết nối thiết bị">
        <p>Biên dịch và nạp chương trình vào board ESP32-S3. Để xem dữ liệu serial, dùng nút Bảng lệnh.</p>
        <DevicePanel code={generatedCode.code} warnings={generatedCode.warnings} />
        <div className="dialog-actions"><button className="btn" onClick={closeDialog}>Đóng</button></div>
      </Modal>
      <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>
    </div>
  );
}
export default App;
