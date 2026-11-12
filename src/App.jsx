import BrowserFlasher from './components/BrowserFlasher.jsx';
import { useDeviceOperation } from './device/useDeviceOperation.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { DEFAULT_BOARD_ID, FAST4WD_BOARD_ID, getBoardProfile, projectBoardId } from './boards/profiles.js';
import { defaultRobotDevices, validateProjectDeviceConfigs } from './boards/robot-devices.js';
import { robotBlocks } from './blocks/robot-devices.js';
import { projectEditorMode, legacyDriveBlocks } from './blocks/beginner-toolbox.js';
import { learningCode } from './ui/learning-code.js';
import { generateArduino } from './generators/arduino.js';
import BlocklyWorkspace from './components/BlocklyWorkspace.jsx';
import CodePreview from './components/CodePreview.jsx';
import DevicePanel from './components/DevicePanel.jsx';
import SerialMonitor from './components/SerialMonitor.jsx';
import TopBar from './ui/TopBar.jsx';
import Modal from './ui/Modal.jsx';
import Dock from './ui/Dock.jsx';
import ZoomControls from './ui/ZoomControls.jsx';
import ChangelogContent from './ui/ChangelogContent.jsx';
import { hasUnseenChangelog, saveSeenVersion } from './ui/changelog.js';
import ProfileToolbar from './ui/ProfileToolbar.jsx';
import { applyBar, readBar, readTheme, saveBar, saveTheme } from './ui/prefs.js';
import { NEWMANIA_MODEL, newmaniaWorkspace, usesNewmaniaProgram } from './blocks/newmania.js';
import { copyToNewmaniaProgram } from './ui/newmania-project.js';
import { LESSONS, lessonProject } from './lessons/newmania.js';
import { clearOldProjectsOnce, projectRobotDevices } from './ui/project-storage.js';

const STORAGE_KEY = 'codelab.projects.v1';
const LEGACY_KEY = 'codelab.workspace.v1';
const FILE_TYPE = 'codelab-project';
const FILE_VERSION = 1;
const emptyWorkspace = { blocks: { languageVersion: 0, blocks: [] } };
function makeProject(name = 'Dự án mới', workspace = emptyWorkspace, boardId = FAST4WD_BOARD_ID, editorMode = 'beginner', deviceConfigs) {
  return { id: crypto.randomUUID(), name, workspace, boardId, editorMode, deviceConfigs, updatedAt: new Date().toISOString() };
}
function makeNewProject(name, workspace = newmaniaWorkspace()) {
  const devices = defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID));
  return { ...makeProject(name, workspace, FAST4WD_BOARD_ID, 'beginner', { [FAST4WD_BOARD_ID]: devices }), programModel: NEWMANIA_MODEL };
}
function readProjects() {
  try {
    clearOldProjectsOnce(localStorage);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.projects?.length) return saved;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    const project = legacy ? makeProject('Chương trình robot của tôi', legacy, DEFAULT_BOARD_ID, 'advanced') : makeNewProject('Chương trình robot của tôi');
    return { activeId: project.id, projects: [project] };
  } catch {
    const project = makeNewProject('Chương trình robot của tôi');
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
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeSize, setCodeSize] = useState(420);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(() => Math.round(Math.min(300, window.innerHeight * 0.42)));
  const [dialog, setDialog] = useState(null);
  const deviceOperation = useDeviceOperation();
  const deviceBusy = deviceOperation.busy;
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState(readTheme);
  const [barColor, setBarColor] = useState(readBar);
  const project = projectStore.projects.find((item) => item.id === projectStore.activeId) || projectStore.projects[0];

  const boardId = projectBoardId(project);
  const robotDevices = useMemo(() => projectRobotDevices(project), [boardId, project.deviceConfigs]);
  const legacyBoard = boardId !== FAST4WD_BOARD_ID;
  const legacyProgram = !legacyBoard && !usesNewmaniaProgram(project);
  const [compatibility, setCompatibility] = useState([]);
  const editorMode = projectEditorMode(project);
  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!hasUnseenChangelog()) return;
    saveSeenVersion();
    setDialog('changelog');
  }, []);
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

  // Capture immediately: Blockly autosave is debounced and may still be pending.
  const snapshotProjects = () => projectStore.projects.map((item) => item.id === project.id
    ? { ...item, workspace: workspaceRef.current && !workspaceRef.current.codelabLoadFailed ? Blockly.serialization.workspaces.save(workspaceRef.current) : item.workspace, updatedAt: new Date().toISOString() }
    : item);
  const switchProject = (id) => {
    if (deviceOperation.isBusy()) return;
    if (id === project.id || !projectStore.projects.some((item) => item.id === id)) return;
    persist({ activeId: id, projects: snapshotProjects() });
  };
  const convertProject = () => {
    if (deviceOperation.isBusy()) return;
    const projects = snapshotProjects();
    const result = copyToNewmaniaProgram(projects.find(item => item.id === project.id), crypto.randomUUID());
    setCompatibility(result.issues);
    if (result.project) persist({ activeId: result.project.id, projects: [...projects, result.project] });
    setDialog('compatibility');
  };
  const createProject = () => {
    if (deviceOperation.isBusy()) return;
    const nextProject = makeNewProject();
    persist({ activeId: nextProject.id, projects: [...snapshotProjects(), nextProject] });
    setDialog(null); showToast('Đã tạo dự án mới');
  };
  const openLesson = (event) => {
    if (deviceOperation.isBusy()) return;
    if (!LESSONS.some(lesson => lesson.id === event.target.value)) return;
    const nextProject = { ...lessonProject(event.target.value), id:crypto.randomUUID(), updatedAt:new Date().toISOString() };
    persist({ activeId: nextProject.id, projects: [...snapshotProjects(), nextProject] });
    showToast(`Đã mở ${nextProject.name}`);
  };
  const renameProject = (event) => {
    const name = event.target.value;
    setProjectStore((current) => ({ ...current, projects: current.projects.map((item) => item.id === current.activeId ? { ...item, name } : item) }));
  };
  const saveProjectFile = () => {
    const state = workspaceRef.current && !workspaceRef.current.codelabLoadFailed ? Blockly.serialization.workspaces.save(workspaceRef.current) : project.workspace;
    const payload = { format: FILE_TYPE, version: FILE_VERSION, project: { name: project.name, workspace: state, boardId, editorMode, deviceConfigs: project.deviceConfigs, programModel: usesNewmaniaProgram(project) ? NEWMANIA_MODEL : project.programModel } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${project.name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'codelab-project'}.codelab.json`; link.click(); URL.revokeObjectURL(url);
    showToast('Đã tải tệp dự án xuống');
  };
  const pickProjectFile = () => {
    if (deviceOperation.isBusy()) return;
    setDialog(null);
    fileInputRef.current?.click();
  };
  const openProjectFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (deviceOperation.isBusy()) { showToast('Đang thao tác thiết bị; hãy mở lại tệp sau khi hoàn tất.'); return; }
      const content = payload.format === FILE_TYPE && payload.version === FILE_VERSION ? payload.project : payload.format === 'codelab-workspace' && payload.version === 1 ? { name: file.name.replace(/\.codelab\.json$|\.json$/i, ''), workspace: payload.workspace } : null;
      if (!content?.workspace) throw new Error('Tệp không đúng định dạng hoặc phiên bản chưa được hỗ trợ.');
      validateProjectDeviceConfigs(content.deviceConfigs);
      if (content.programModel && content.programModel !== NEWMANIA_MODEL) throw new Error('Phiên bản cấu trúc chương trình chưa được hỗ trợ.');
      // Validate in isolation before replacing the visible workspace or saved projects.
      const validationWorkspace = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(content.workspace, validationWorkspace);
      } finally {
        validationWorkspace.dispose();
      }
      const imported = { ...content, ...makeProject(content.name || file.name, content.workspace, projectBoardId(content), projectEditorMode(content), content.deviceConfigs), ...(usesNewmaniaProgram(content) ? { programModel: NEWMANIA_MODEL } : {}) };
      persist({ activeId: imported.id, projects: [...snapshotProjects(), imported] });
      showToast(`Đã mở ${file.name}`);
    } catch (error) { window.alert(error.message || 'Không thể mở dự án.'); }
  };
  const closeDialog = useCallback(() => { if (!deviceOperation.isBusy()) setDialog(null); }, [deviceOperation.isBusy]);

  const openDevice = () => {
    if (deviceOperation.isBusy() || legacyBoard) return;
    if (workspaceRef.current?.codelabLoadFailed) { showToast('Workspace mở chưa đầy đủ; giữ bản gốc và chưa biên dịch.'); return; }
    if (workspaceRef.current) handleCodeChange(generateArduino(workspaceRef.current, boardId, robotDevices));
    setTerminalOpen(false);
    setCodeOpen(false);
    setDialog('connect');
  };
  const toggleTerminal = () => {
    if (deviceOperation.isBusy()) return;
    const next = !terminalOpen;
    setTerminalOpen(next);
    if (next) { setCodeOpen(false); setDialog(null); }
  };
  const toggleCode = () => {
    if (deviceOperation.isBusy()) return;
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
  const codeVertical = () => window.innerWidth <= 760;
  const clampCode = value => Math.max(220, Math.min(value, codeVertical() ? window.innerHeight * 0.55 : window.innerWidth - 340));
  const resizeCode = event => {
    event.preventDefault();
    const vertical = codeVertical(), start = vertical ? event.clientY : event.clientX;
    const initial = codeSize, target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    const move = e => setCodeSize(clampCode(initial + start - (vertical ? e.clientY : e.clientX)));
    const stop = () => { target.removeEventListener('pointermove',move); target.removeEventListener('pointerup',stop); target.removeEventListener('pointercancel',stop); };
    target.addEventListener('pointermove',move); target.addEventListener('pointerup',stop); target.addEventListener('pointercancel',stop);
  };
  const resizeCodeKey = event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setCodeSize(size => clampCode(size + (['ArrowLeft','ArrowUp'].includes(event.key) ? 24 : -24)));
  };

  return (
    <div className={`app${terminalOpen ? ' has-console' : ''}`} style={{ '--console-h': `${consoleHeight}px` }}>
      <TopBar
        projects={projectStore.projects} activeProjectId={project.id} onSwitchProject={switchProject}
        projectName={project?.name || ''} onRename={renameProject} onRenameCommit={() => persist(projectStore)}
        onNew={createProject} onOpenFile={pickProjectFile} onSave={saveProjectFile}
        onHelp={() => setDialog('help')} onChangelog={() => setDialog('changelog')} onConnect={openDevice}
        onToggleTerminal={toggleTerminal} onToggleCode={toggleCode}
        terminalOpen={terminalOpen} codeOpen={codeOpen}
        theme={theme} onTheme={changeTheme} barColor={barColor} onBarColor={changeBar}
        onLanguage={() => showToast('Chưa có bản dịch, hiện chỉ có Tiếng Việt')}
      />
      <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,.codelab.json,application/json" onChange={openProjectFile} />
      <ProfileToolbar
        boardId={boardId}
        boards={[{ id: FAST4WD_BOARD_ID, name: 'Newmania ESP32S3 Board' }, ...(boardId !== FAST4WD_BOARD_ID ? [{ id: boardId, name: `Board của dự án đã nhập: ${boardId}` }] : [])]}
        onBoard={() => {}}
        lessons={LESSONS}
        onLesson={(value) => openLesson({ target: { value } })}
      />
      {(legacyBoard || legacyProgram) && <div role="alert">{legacyBoard ? `Dự án cũ dùng board ${boardId}. Chưa chuyển sang Newmania; giữ nguyên dữ liệu và board gốc.` : 'Dự án dùng cấu trúc cũ; giữ nguyên các luồng và cách sinh mã hiện có.'}
        <button className="btn" onClick={() => setDialog('convert')}>Tạo bản sao Newmania…</button>
      </div>}
      {legacyDriveBlocks(project.workspace).length > 0 && <div className="legacy-block-note" role="status">Dự án cũ có block di chuyển tổng hợp ({legacyDriveBlocks(project.workspace).join(', ')}). Block và dữ liệu vẫn được giữ nguyên để mở, sửa và xuất; toolbox học sinh chỉ cung cấp Motor riêng lẻ.</div>}
      <div className="main" style={{'--code-size':`${codeSize}px`}}>
        <div className="ws" aria-label="Trình chỉnh sửa khối lệnh">
          <BlocklyWorkspace key={project?.id} boardId={boardId} editorMode="beginner" programModel={usesNewmaniaProgram(project) ? NEWMANIA_MODEL : undefined} robotDevices={robotDevices} initialState={project?.workspace} dark={theme === 'dark'} onChange={handleWorkspaceChange} onCodeChange={handleCodeChange} workspaceRef={workspaceRef} />
          <ZoomControls workspaceRef={workspaceRef} />
          <div className="workspace-status"><span><i className="status-dot" />Sẵn sàng chỉnh sửa</span><span>{blockCount} khối đang dùng</span></div>
        </div>
        <Dock open={codeOpen} genie="code" edge="right" wrapClassName="code-dock" className="code-side" aria-label="Mã được sinh">
          <div className="code-grip" role="separator" aria-label="Đổi kích thước mã nguồn" aria-valuenow={codeSize} aria-valuemin={220} tabIndex={0} onPointerDown={resizeCode} onKeyDown={resizeCodeKey} />
          <h2>Mã nguồn<button className="x" onClick={() => setCodeOpen(false)} aria-label="Đóng mã nguồn">×</button></h2>
          <CodePreview code={generatedCode.code} warnings={generatedCode.warnings} logic={learningCode(project.workspace)} />
        </Dock>
      </div>
      <Dock open={terminalOpen} genie="terminal" edge="bottom" as="section" className="console" aria-label="Bảng lệnh" wrapStyle={{ '--console-h': `${consoleHeight}px` }}>
        <div className="console-grip" role="separator" aria-orientation="horizontal" aria-label="Kéo để đổi kích thước bảng lệnh" aria-valuemin={CONSOLE_MIN} aria-valuenow={consoleHeight} tabIndex={0} title="Kéo xuống để thu nhỏ, kéo lên để phóng to" onPointerDown={startResize} onKeyDown={resizeByKey} onDoubleClick={toggleConsoleSize} />
        <h2>Bảng lệnh<button className="x" onClick={() => setTerminalOpen(false)} aria-label="Đóng">×</button></h2>
        <SerialMonitor />
      </Dock>

      <Modal open={dialog === 'convert'} onClose={closeDialog} title="Tạo bản sao Newmania?">
        <p>Bản gốc giữ nguyên board và dữ liệu. Bản sao dùng một luồng tự chạy sau khi board khởi động, không dùng Options ARM hoặc Share STOP. Nếu có block hoặc sự kiện không thể chuyển đúng hành vi, hệ thống báo rõ và không tạo bản sao chuyển đổi một phần.</p>
        <button className="btn p" onClick={convertProject}>Xác nhận tạo bản sao</button>
        <button className="btn" onClick={closeDialog}>Hủy</button>
      </Modal>
      <Modal open={dialog === 'compatibility'} onClose={closeDialog} title={compatibility.length ? "Chưa thể chuyển dự án" : "Kiểm tra bản sao Newmania"}>
        {compatibility.length ? <ul>{compatibility.map(item => <li key={item.id}>{item.type} ({item.id}): {item.warnings.join(' ')}</li>)}</ul> : <p>Đã tạo bản sao Newmania mới; block và biến đã được kiểm tra.</p>}
        <button className="btn" onClick={closeDialog}>Đóng</button>
      </Modal>
      <Modal open={dialog === 'changelog'} genie="changelog" onClose={closeDialog} title="Changelog">
        <ChangelogContent />
        <div className="dialog-actions"><button className="btn p" onClick={closeDialog}>Đã hiểu</button></div>
      </Modal>
      <Modal open={dialog === 'help'} genie="help" onClose={closeDialog} title="Hướng dẫn nhanh">
        <ol>
          <li>Chọn nhóm block ở cột bên trái.</li>
          <li>Kéo khối vào vùng làm việc; kéo khối vào cột bên trái để xóa.</li>
          <li>Thả khối gần đáy khối khác để nối thành chuỗi.</li>
          <li>Bấm nút code để xem code text.</li>
        </ol>
        <details><summary>Help các khối cấu hình robot</summary>
          <dl>{robotBlocks.map(({ type, title, tooltip }) => <div key={type}><dt><strong>{title}</strong></dt><dd>{tooltip}</dd></div>)}</dl>
        </details>
        <button className="btn p" onClick={closeDialog}>Đã hiểu</button>
      </Modal>
      <Modal open={dialog === 'connect'} genie="connect" locked={deviceBusy} onClose={closeDialog} title="Kết nối thiết bị">
        <p>Biên dịch chương trình, sau đó chọn USB và nạp vào robot. Để xem dữ liệu Serial, dùng nút Bảng lệnh.</p>
        <DevicePanel key={project.id + boardId} operation={deviceOperation} boardId={boardId} code={generatedCode.boardId === boardId ? generatedCode.code : ''} warnings={boardId === FAST4WD_BOARD_ID ? generatedCode.warnings : [...generatedCode.warnings, 'Dự án này sử dụng board khác; board gốc được giữ nguyên.']} onOpenSerial={toggleTerminal} />
        <BrowserFlasher boardId={boardId} operation={deviceOperation} />
        <div className="dialog-actions"><button className="btn" disabled={deviceBusy} onClick={closeDialog}>Đóng</button></div>
      </Modal>
      <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>
    </div>
  );
}
export default App;
