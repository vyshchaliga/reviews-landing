import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, stringifyCSV } from './csv.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CSV_PATH = path.join(ROOT, 'public', 'data', 'reviews.csv');
export const SHOTS_DIR = path.join(ROOT, 'public', 'assets', 'shots');

export function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function readRows() { return parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).rows; }
export function writeRows(rows) { fs.writeFileSync(CSV_PATH, stringifyCSV(rows)); }

// --ключ значення  →  { ключ: значення }
export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith('--')) o[k] = true; else { o[k] = nxt; i++; }
    }
  }
  return o;
}

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Вставка рядка: --position N (1 = перший у стіні), за замовчуванням в кінець
export function insertRow(rows, row, position) {
  const n = parseInt(position, 10);
  if (n >= 1 && n <= rows.length) rows.splice(n - 1, 0, row); else rows.push(row);
  return rows;
}

export function requireNames(a) {
  for (const k of ['name-ua', 'name-ru', 'niche-ua', 'niche-ru']) {
    if (!a[k] || a[k] === true) { console.error(`Не вистачає --${k}`); process.exit(1); }
  }
}
