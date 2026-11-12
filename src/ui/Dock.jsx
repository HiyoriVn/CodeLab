import { useLayoutEffect, useRef } from 'react';
import { GENIE_MS, setGenieOrigin, usePresence } from './presence.js';

function Dock({ open, genie, edge = 'right', as: Tag = 'aside', wrapStyle, wrapClassName = '', className = '', children, ...rest }) {
  const { shown, closing } = usePresence(open, GENIE_MS);
  const panelRef = useRef(null);
  useLayoutEffect(() => { setGenieOrigin(panelRef.current, genie); }, [shown, closing, genie]);
  if (!shown) return null;
  return (
    <div className={`dock dock-${edge} ${wrapClassName} ${closing ? 'is-closing' : 'is-opening'}`} style={wrapStyle}>
      <Tag ref={panelRef} className={`dock-panel ${className}`.trim()} {...rest}>{children}</Tag>
    </div>
  );
}

export default Dock;
