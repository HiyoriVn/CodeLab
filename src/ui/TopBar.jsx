import { useEffect, useState } from 'react';
import { BARS, BAR_DEFAULT } from './prefs.js';

const icon = (name) => `${import.meta.env.BASE_URL}images/${name}.png`;

function TopBar({
  projectName, onRename, onRenameCommit,
  onNew, onOpenFile, onSave, onHelp, onConnect,
  onToggleTerminal, onToggleCode, terminalOpen, codeOpen,
  theme, onTheme, barColor, onBarColor, onLanguage,
}) {
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    const onClick = (event) => { if (!event.target.closest('[data-menu-root]')) setMenu(null); };
    const onKey = (event) => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const toggle = (name) => setMenu((current) => (current === name ? null : name));
  const run = (action) => () => { setMenu(null); action(); };

  return (
    <header className="topbar">
      <div className="logo">
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#FFC83D" /><path d="M9 23V9l14 14V9" fill="none" stroke="#4A3AB0" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        CodeLab
      </div>

      <div className="rel" data-menu-root>
        <button className="nb dd" aria-expanded={menu === 'settings'} onClick={() => toggle('settings')}>Cài đặt</button>
        {menu === 'settings' && (
          <div className="pop set set-bar">
            <div className="field-col"><label htmlFor="lang">Ngôn ngữ</label>
              <select id="lang" defaultValue="vi" onChange={onLanguage}><option value="vi">Tiếng Việt</option><option value="en">English</option></select>
            </div>
          </div>
        )}
      </div>

      <div className="rel" data-menu-root>
        <button className="nb dd" aria-expanded={menu === 'file'} onClick={() => toggle('file')}>Tập tin</button>
        {menu === 'file' && (
          <div className="pop">
            <button className="mi" onClick={run(onNew)}>Mới</button>
            <button className="mi" onClick={run(onOpenFile)}>Mở từ máy tính</button>
            <button className="mi" onClick={run(onSave)}>Lưu về máy tính</button>
          </div>
        )}
      </div>

      <button className="nb" onClick={onHelp}>Hướng dẫn</button>
      <input className="project-name" aria-label="Tên dự án" value={projectName} onChange={onRename} onBlur={onRenameCommit} />
      <div className="spacer" />

      <button type="button" className="tm" role="switch" aria-checked={theme === 'dark'} aria-label="Giao diện tối" title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}>
        <span className="tm-thumb" aria-hidden="true" />
        <svg className="tm-ico tm-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>
        <svg className="tm-ico tm-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.2 8.2 0 1 0 20 14.2z" /></svg>
      </button>

      <div className="rel" data-menu-root>
        <button className="ib col" aria-expanded={menu === 'color'} aria-label="Đổi màu menu" data-tip="Đổi màu menu" onClick={() => toggle('color')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".6" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".6" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".6" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".6" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z" /></svg>
        </button>
        {menu === 'color' && (
          <div className="pop set colp">
            <b>Màu thanh menu</b>
            <div className="sw" role="group" aria-label="Bảng màu">
              {BARS.map(([color, name]) => (
                <button key={color} type="button" style={{ background: color }} title={name} aria-label={name} aria-pressed={barColor.toUpperCase() === color} onClick={() => onBarColor(color)} />
              ))}
            </div>
            <label className="cust" htmlFor="bar-custom">Màu tùy chọn<input type="color" id="bar-custom" value={barColor.toLowerCase()} onChange={(event) => onBarColor(event.target.value)} /></label>
            <button className="btn" type="button" onClick={() => onBarColor(BAR_DEFAULT)}>Về màu mặc định</button>
          </div>
        )}
      </div>

      <button className="ib" onClick={onConnect} aria-label="Thiết bị" data-tip="Thiết bị"><img src={icon('ket-noi')} alt="" /></button>
      <button className="ib" onClick={onToggleTerminal} aria-pressed={terminalOpen} aria-label="Bảng lệnh" data-tip="Bảng lệnh"><img src={icon('bang-lenh')} alt="" /></button>
      <button className="ib" onClick={onToggleCode} aria-pressed={codeOpen} aria-label="Code" data-tip="Code"><img src={icon('hien-code')} alt="" /></button>
    </header>
  );
}

export default TopBar;
