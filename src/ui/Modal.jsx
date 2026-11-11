import { useEffect, useRef } from 'react';

function Modal({ open, onClose, title, children, locked = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={() => { if (!locked) onClose(); }}
      onCancel={(event) => { if (locked) event.preventDefault(); }}
      onClick={(event) => { if (!locked && event.target === ref.current) onClose(); }}
    >
      {open && <><h3>{title}</h3>{children}</>}
    </dialog>
  );
}

export default Modal;
