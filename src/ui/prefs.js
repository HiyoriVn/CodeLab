export const BAR_DEFAULT = '#1976D2';
const BAR_KEY = 'codelab.bar-color.v1';
const THEME_KEY = 'codelab.theme.v1';

export const BARS = [
  ['#1976D2', 'Xanh da trời (mặc định)'], ['#4B5563', 'Xám trung tính'], ['#1F2937', 'Than chì'],
  ['#334155', 'Xám xanh'], ['#4A3AB0', 'Tím chàm'], ['#2563EB', 'Xanh dương'], ['#0F766E', 'Xanh ngọc'],
  ['#15803D', 'Xanh lá'], ['#B45309', 'Cam đất'], ['#B91C1C', 'Đỏ'], ['#BE185D', 'Hồng'],
  ['#E5E7EB', 'Xám nhạt'], ['#FFFFFF', 'Trắng'],
];

const darken = (hex, factor) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.substr(i, 2), 16) * factor).toString(16).padStart(2, '0')).join('')}`;
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const inkFor = (hex) => {
  const L = luminance(hex);
  return 1.05 / (L + 0.05) >= (L + 0.05) / (luminance('#1F2340') + 0.05) ? '#fff' : '#1F2340';
};

export const normalizeBar = (value) => {
  const hex = String(value || '').toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : BAR_DEFAULT;
};

export function applyBar(value) {
  const hex = normalizeBar(value);
  const ink = inkFor(hex);
  const style = document.documentElement.style;
  style.setProperty('--bar', hex);
  style.setProperty('--bar2', darken(hex, ink === '#fff' ? 0.8 : 0.88));
  style.setProperty('--bar-ink', ink);
  style.setProperty('--icf', ink === '#fff' ? 'none' : 'invert(1)');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex);
}

export function readBar() {
  try { return normalizeBar(localStorage.getItem(BAR_KEY)); } catch { return BAR_DEFAULT; }
}
export function saveBar(value) {
  try {
    if (normalizeBar(value) === BAR_DEFAULT) localStorage.removeItem(BAR_KEY);
    else localStorage.setItem(BAR_KEY, normalizeBar(value));
  } catch { /* storage unavailable */ }
}

export function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable */ }
  return 'light';
}
export function saveTheme(value) {
  try { localStorage.setItem(THEME_KEY, value); } catch { /* storage unavailable */ }
}
