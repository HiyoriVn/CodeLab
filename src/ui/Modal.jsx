import { useEffect, useLayoutEffect, useRef } from 'react';
import { GENIE_MS, setGenieOrigin, usePresence } from './presence.js';

function Modal({ open, onClose, title, children, locked = false }) {
  const ref = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;
  const { shown, closing } = usePresence(open, GENIE_MS);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (shown) setGenieOrigin(dialog, genie);
  }, [open, shown, closing, genie]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !shown && dialog.open) dialog.close();
  }, [shown]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={() => { if (!locked) onClose(); }}
      onCancel={(event) => { if (locked) event.preventDefault(); }}
      onClick={(event) => { if (!locked && event.target === ref.current) onClose(); }}
    >
      {shown && <><h3>{title}</h3>{children}</>}
    </dialog>
  );
}

export default Modal;
