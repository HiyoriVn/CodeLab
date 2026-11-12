import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { POP_MS, usePresence } from './presence.js';

function Select({ labelId, value, options, onChange, placeholder = 'Chọn…', menuHeader, className = '' }) {
  const uid = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const typeahead = useRef({ text: '', timer: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [alignEnd, setAlignEnd] = useState(false);
  const { shown, closing } = usePresence(open, POP_MS);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];
  const listId = `${uid}-list`;
  const optionId = (index) => `${uid}-opt-${index}`;

  const openMenu = () => { setActive(selectedIndex >= 0 ? selectedIndex : 0); setOpen(true); };
  const closeMenu = (returnFocus = false) => { setOpen(false); if (returnFocus) buttonRef.current?.focus(); };
  const choose = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    closeMenu(true);
    if (option.value !== value) onChange(option.value);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !rootRef.current) return;
    const rootBox = rootRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current.offsetWidth;
    setAlignEnd(rootBox.left + menuWidth > window.innerWidth - 8 && rootBox.right - menuWidth >= 8);
  }, [open, shown]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  const move = (delta) => setActive((current) => {
    const count = options.length;
    if (!count) return -1;
    let next = current;
    for (let step = 0; step < count; step += 1) {
      next = (next + delta + count) % count;
      if (!options[next].disabled) return next;
    }
    return current;
  });

  const jumpTo = (text) => {
    const needle = text.toLowerCase();
    const from = Math.max(active, 0);
    const order = options.map((_, i) => (from + 1 + i) % options.length);
    const hit = order.find((i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(needle));
    if (hit !== undefined) { if (!open) setOpen(true); setActive(hit); }
  };

  const onKeyDown = (event) => {
    const { key } = event;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) { event.preventDefault(); openMenu(); }
      return;
    }
    if (key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (key === 'Home') { event.preventDefault(); setActive(options.findIndex((o) => !o.disabled)); }
    else if (key === 'End') { event.preventDefault(); setActive(options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled)); }
    else if (key === 'Enter' || key === ' ') { event.preventDefault(); choose(active); }
    else if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
    else if (key === 'Tab') setOpen(false);
    else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const state = typeahead.current;
      window.clearTimeout(state.timer);
      state.text += key;
      state.timer = window.setTimeout(() => { state.text = ''; }, 600);
      jumpTo(state.text);
    }
  };

  const warnTag = selected?.tags?.find((tag) => tag.tone === 'warn');

  return (
    <div className={`sel ${className}`.trim()} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="sel-btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-labelledby={labelId ? `${labelId} ${uid}-value` : undefined}
        title={selected?.label}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span id={`${uid}-value`} className={`sel-value ${selected ? '' : 'is-placeholder'}`.trim()}>{selected ? selected.label : placeholder}</span>
        {warnTag && <span className="sel-tag tone-warn">{warnTag.text}</span>}
        <svg className="sel-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {shown && (
        <ul
          ref={menuRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          className={`sel-menu ${alignEnd ? 'is-end' : ''} ${closing ? 'is-closing' : ''}`.replace(/\s+/g, ' ').trim()}
          onMouseDown={(event) => event.preventDefault()}
        >
          {menuHeader && <li role="presentation" className="sel-head">{menuHeader}</li>}
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={option.disabled || undefined}
              className={`sel-opt ${index === active ? 'is-active' : ''}`.trim()}
              onPointerEnter={() => !option.disabled && setActive(index)}
              onClick={() => choose(index)}
            >
              <svg className="sel-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.4 3 3 6-6.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="sel-body">
                <span className="sel-title-row">
                  <span className="sel-title">{option.label}</span>
                  {option.tags?.map((tag) => <span key={tag.text} className={`sel-tag tone-${tag.tone || 'neutral'}`}>{tag.text}</span>)}
                </span>
                {option.hint && <span className="sel-hint">{option.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Select;
