import { useEffect, useState } from 'react';

export const GENIE_MS = 420;
export const POP_MS = 170;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function usePresence(open, ms = GENIE_MS) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return undefined; }
    const timer = window.setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : ms);
    return () => window.clearTimeout(timer);
  }, [open, ms]);
  return { shown: open || mounted, closing: !open && mounted };
}

export function setGenieOrigin(el, key) {
  if (!el) return;
  const button = key ? document.querySelector(`[data-genie="${key}"]`) : null;
  if (!button) { el.style.removeProperty('--ox'); el.style.removeProperty('--oy'); return; }
  const previous = el.style.animation;
  el.style.animation = 'none';
  const box = el.getBoundingClientRect();
  el.style.animation = previous;
  const target = button.getBoundingClientRect();
  el.style.setProperty('--ox', `${Math.round(target.left + target.width / 2 - box.left)}px`);
  el.style.setProperty('--oy', `${Math.round(target.top + target.height / 2 - box.top)}px`);
}
