import { createElement } from 'react';

const CONTROL = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'goto', 'try', 'catch', 'throw']);
const STORAGE = new Set([
  'void', 'int', 'long', 'short', 'float', 'double', 'char', 'bool', 'boolean', 'unsigned', 'signed',
  'const', 'static', 'volatile', 'class', 'struct', 'enum', 'typedef', 'namespace', 'public', 'private',
  'protected', 'virtual', 'inline', 'extern', 'auto', 'template', 'typename', 'new', 'delete', 'operator',
  'this', 'sizeof', 'true', 'false', 'nullptr', 'NULL', 'using',
]);

const TOKEN = new RegExp([
  '(\\/\\/[^\\n]*)',
  '(\\/\\*[\\s\\S]*?(?:\\*\\/|$))',
  '(^[ \\t]*#[ \\t]*[A-Za-z_]+)',
  '("(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?)',
  '(<[A-Za-z0-9_./]+>)',
  '(0[xX][0-9a-fA-F]+[uUlL]*|\\d+\\.?\\d*(?:[eE][+-]?\\d+)?[fFuUlL]*|\\.\\d+[fF]?)', 
  '([A-Za-z_]\\w*)',
].join('|'), 'gm');

const span = (cls, text, key) => createElement('span', { className: cls, key }, text);

export function highlightCpp(source) {
  const out = [];
  let plain = '';
  let index = 0;
  let key = 0;
  let includeEnd = -1;
  const flush = () => { if (plain) { out.push(plain); plain = ''; } };
  const push = (cls, text) => { flush(); out.push(span(cls, text, key++)); };

  let match;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(source)) !== null) {
    if (match.index > index) plain += source.slice(index, match.index);
    index = TOKEN.lastIndex;
    const text = match[0];
    if (!text) { TOKEN.lastIndex += 1; continue; }

    if (match[1] || match[2]) { push('tok-comment', text); }
    else if (match[3]) {
      const lead = text.match(/^[ \t]*/)[0];
      if (lead) plain += lead;
      push('tok-control', text.slice(lead.length));
      includeEnd = /include/.test(text) ? index : -1;
    }
    else if (match[4]) { push('tok-string', text); }
    else if (match[5]) {
      if (includeEnd >= 0 && !source.slice(includeEnd, match.index).includes('\n')) push('tok-string', text); else plain += text;
    }
    else if (match[6]) { push('tok-number', text); }
    else if (match[7]) {
      let cls = 'tok-variable';
      const next = source.slice(index).match(/^\s*(.)/)?.[1];
      if (CONTROL.has(text)) cls = 'tok-control';
      else if (STORAGE.has(text)) cls = 'tok-storage';
      else if (/^[A-Z][A-Z0-9_]+$/.test(text)) cls = 'tok-const';
      else if (/^(Serial\d?|Wire\d?)$/.test(text)) cls = 'tok-variable';
      else if (/^[A-Z]/.test(text) || /_t$/.test(text)) cls = 'tok-type';
      else if (next === '(') cls = 'tok-function';
      push(cls, text);
    }
  }
  if (index < source.length) plain += source.slice(index);
  flush();
  return out;
}
