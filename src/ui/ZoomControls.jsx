const icon = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function ZoomControls({ workspaceRef }) {
  const zoom = (delta) => workspaceRef.current?.zoomCenter(delta);
  const reset = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.setScale(workspace.options.zoomOptions?.startScale ?? 0.9);
    workspace.scrollCenter();
  };

  return (
    <div className="zoom-ctl" role="group" aria-label="Thu phóng vùng làm việc">
      <button type="button" className="zoom-btn" aria-label="Phóng to" title="Phóng to" onClick={() => zoom(1)}>
        <svg {...icon}><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5v9M7.5 12h9" /></svg>
      </button>
      <button type="button" className="zoom-btn" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => zoom(-1)}>
        <svg {...icon}><circle cx="12" cy="12" r="9.5" /><path d="M7.5 12h9" /></svg>
      </button>
      <button type="button" className="zoom-btn zoom-reset" aria-label="Về kích thước mặc định" title="Về kích thước mặc định" onClick={reset}>
        <svg {...icon}><path d="M6 9h12M6 15h12" /></svg>
      </button>
    </div>
  );
}

export default ZoomControls;
