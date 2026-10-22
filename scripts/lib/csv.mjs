// Мінімальний CSV-парсер/серіалізатор без залежностей.
export const COLUMNS = ['type', 'media', 'w', 'h', 'name_ua', 'name_ru', 'niche_ua', 'niche_ru', 'ring'];

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (ch !== '\r') f += ch;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim());
  const data = rows
    .filter((r) => r.join('').trim() !== '')
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  return { head, rows: data };
}

const esc = (v) => {
  v = String(v ?? '');
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

export function stringifyCSV(rows) {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => esc(r[c])).join(','));
  return lines.join('\n') + '\n';
}
