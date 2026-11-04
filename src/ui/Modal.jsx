import { useEffect, useRef } from 'react';

function Modal({ open, onClose, title, children }) {
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
      onClose={onClose}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
    >
      {open && <><h3>{title}</h3>{children}</>}
    </dialog>
  );
}

export default Modal;
