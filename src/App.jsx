import { useCallback, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import BlocklyWorkspace from './components/BlocklyWorkspace.jsx';
import CodePreview from './components/CodePreview.jsx';
import DevicePanel from './components/DevicePanel.jsx';
import SerialMonitor from './components/SerialMonitor.jsx';

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
  const [projectStore, setProjectStore] = useState(readProjects);
  const [generatedCode, setGeneratedCode] = useState({ code: '', warnings: [] });
  const [panel, setPanel] = useState('code');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const project = projectStore.projects.find((item) => item.id === projectStore.activeId) || projectStore.projects[0];
  const persist = useCallback((next) => {
    setProjectStore(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setNotice('Đã lưu trên trình duyệt này'); }
    catch { setNotice('Không đủ chỗ lưu — hãy tải dự án xuống máy'); }
  }, []);
  const handleWorkspaceChange = useCallback((workspace) => {
    setProjectStore((current) => {
      const next = { ...current, projects: current.projects.map((item) => item.id === current.activeId ? { ...item, workspace, updatedAt: new Date().toISOString() } : item) };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setNotice('Đã lưu trên trình duyệt này'); }
      catch { setNotice('Không đủ chỗ lưu — hãy tải dự án xuống máy'); }
      return next;
    });
  }, []);
  const createProject = () => {
    const nextProject = makeProject();
    persist({ activeId: nextProject.id, projects: [...projectStore.projects, nextProject] });
    workspaceRef.current?.clear(); setProjectMenuOpen(false);
  };
  const switchProject = (id) => {
    if (id === project?.id) return;
    const currentWorkspace = workspaceRef.current;
    const state = currentWorkspace ? Blockly.serialization.workspaces.save(currentWorkspace) : project?.workspace;
    const next = { ...projectStore, activeId: id, projects: projectStore.projects.map((item) => item.id === project?.id ? { ...item, workspace: state } : item) };
    persist(next); setProjectMenuOpen(false);
    const selected = next.projects.find((item) => item.id === id);
    if (selected && currentWorkspace) Blockly.serialization.workspaces.load(selected.workspace || emptyWorkspace, currentWorkspace);
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
    setNotice('Đã tải tệp dự án xuống');
  };
  const openProjectFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const content = payload.format === FILE_TYPE && payload.version === FILE_VERSION ? payload.project : payload.format === 'codelab-workspace' && payload.version === 1 ? { name: file.name.replace(/\.codelab\.json$|\.json$/i, ''), workspace: payload.workspace } : null;
      if (!content?.workspace) throw new Error('Tệp không đúng định dạng hoặc phiên bản chưa được hỗ trợ.');
      const imported = makeProject(content.name || file.name, content.workspace);
      persist({ activeId: imported.id, projects: [...projectStore.projects, imported] });
      if (workspaceRef.current) Blockly.serialization.workspaces.load(imported.workspace, workspaceRef.current);
      setNotice(`Đã mở ${file.name}`);
    } catch (error) { window.alert(error.message || 'Không thể mở dự án.'); }
  };
  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <a className="brand" href="/" aria-label="CodeLab trang chính"><span className="brand-mark">N</span><span className="brand-copy"><strong>CodeLab</strong><small>ROBOTICS STUDIO</small></span></a>
        <div className="project-switcher-wrap">
          <button className="project-switcher" onClick={() => setProjectMenuOpen((value) => !value)} aria-expanded={projectMenuOpen}><span className="project-glyph">▧</span><span className="project-current"><small>DỰ ÁN CỦA TÔI</small><strong>{project?.name || 'Dự án mới'}</strong></span><span className="chevron">⌄</span></button>
          {projectMenuOpen && <div className="project-menu"><div className="menu-caption">DỰ ÁN TRÊN TRÌNH DUYỆT NÀY</div>{projectStore.projects.map((item) => <button key={item.id} className="project-menu-item" onClick={() => switchProject(item.id)}><span>{item.name}</span><small>{item.id === project?.id ? 'Đang mở' : new Date(item.updatedAt).toLocaleDateString('vi-VN')}</small></button>)}<button className="project-menu-new" onClick={createProject}>＋ Tạo dự án mới</button><button className="project-menu-new" onClick={() => fileInputRef.current?.click()}>↥ Mở tệp dự án</button></div>}
        </div>
        <div className="save-indicator"><i />{notice || 'Tự lưu trên trình duyệt'}</div>
        <div className="topbar-actions"><button className="button button-quiet" onClick={() => fileInputRef.current?.click()}>Mở dự án</button><button className="button button-primary" onClick={saveProjectFile}>Lưu về máy</button><input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,.codelab.json,application/json" onChange={openProjectFile} /></div>
      </header>
      <section className="editor-toolbar">
        <div className="toolbar-title"><span className="phase-tag">ESP32-S3 · ARDUINO C++</span><input aria-label="Tên dự án" value={project?.name || ''} onChange={renameProject} onBlur={() => persist(projectStore)} /></div>
        <div className="toolbar-actions"><span className="autosave-note"><i className="status-dot" />Đã tự lưu</span><button className="button button-quiet" onClick={createProject}>＋ Dự án mới</button><button className="button button-quiet" onClick={() => setPanel('device')}>⇧ Biên dịch & nạp</button></div>
      </section>
      <section className="editor-frame" aria-label="Trình chỉnh sửa khối lệnh">
        <div className="editor-heading"><div><span className="editor-icon">▦</span><strong>Không gian lập trình</strong><span className="editor-divider">/</span><span className="editor-muted">Khối lệnh</span></div><span className="keyboard-hint">Kéo khối vào vùng làm việc</span></div>
        <div className="editor-body"><div className="workspace-area"><BlocklyWorkspace key={project?.id} initialState={project?.workspace} onChange={handleWorkspaceChange} onCodeChange={setGeneratedCode} workspaceRef={workspaceRef} /><div className="workspace-status"><span><i className="status-dot" />Sẵn sàng chỉnh sửa</span><span>{workspaceRef.current?.getAllBlocks(false).length || 0} khối đang dùng</span></div></div>
          <aside className="side-panel"><div className="panel-tabs" role="tablist" aria-label="Bảng công cụ"><button role="tab" aria-selected={panel === 'code'} className={panel === 'code' ? 'active' : ''} onClick={() => setPanel('code')}><span>⌘</span> Code</button><button role="tab" aria-selected={panel === 'console'} className={panel === 'console' ? 'active' : ''} onClick={() => setPanel('console')}><span>▤</span> Bảng lệnh</button><button role="tab" aria-selected={panel === 'device'} className={panel === 'device' ? 'active' : ''} onClick={() => setPanel('device')}><span>⎓</span> Thiết bị</button><button className="panel-hide" aria-label="Đóng bảng bên" onClick={() => setPanel('closed')}>×</button></div>
            {panel === 'code' && <CodePreview code={generatedCode.code} warnings={generatedCode.warnings} />}
            {panel === 'console' && <SerialMonitor />}
            {panel === 'device' && <DevicePanel code={generatedCode.code} warnings={generatedCode.warnings} />}
            {panel === 'closed' && <button className="panel-reopen" onClick={() => setPanel('code')}>Mở bảng bên ›</button>}
          </aside>
        </div>
      </section>
      <footer className="page-footer"><span>CodeLab · Lập trình robot bằng khối</span><span>{projectStore.projects.length} dự án cục bộ · Không gian lưu trong trình duyệt này</span></footer>
    </main>
  );
}
export default App;
