// Перевірка таблиці відгуків. Запускається вручну і автоматично перед кожним деплоєм на Vercel.
// node scripts/validate.mjs        → перевірити
// node scripts/validate.mjs --fix  → доповнити ширину/висоту скрінів
import fs from 'node:fs';
import path from 'node:path';
import { COLUMNS } from './lib/csv.mjs';
import { CSV_PATH, SHOTS_DIR, readRows, writeRows, parseArgs, cap } from './lib/common.mjs';
import { imageSize } from './lib/imgsize.mjs';
import { parseCSV } from './lib/csv.mjs';
import { buildUaPage } from './build-ua-page.mjs';
import { buildAgentUaPage } from './build-agent-ua-page.mjs';

const args = parseArgs(process.argv.slice(2));
const errors = [], warns = [];

// Українська сторінка передзапису збирається з російської, щоб адреси не розійшлись
try {
  const ua = buildUaPage();
  if (ua.changed) console.log('public/pre-reg-form/ua.html перезібрано.');
} catch (e) {
  console.log('  ✖ не вдалося зібрати українську сторінку передзапису: ' + e.message);
  process.exit(1);
}
try {
  const ua = buildAgentUaPage();
  if (ua.changed) console.log('public/pre-reg-form-agent/ua.html перезібрано.');
} catch (e) {
  console.log('  ✖ не вдалося зібрати українську сторінку для агенцій: ' + e.message);
  process.exit(1);
}
const { head } = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
for (const c of COLUMNS) if (!head.includes(c)) errors.push(`У таблиці немає колонки «${c}»`);
if (errors.length) { report(); }

const rows = readRows();
let videos = 0, shots = 0, pending = 0, changed = false;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

rows.forEach((r, i) => {
  const n = i + 1, where = `рядок ${n}`;
  if (r.type !== 'video' && r.type !== 'shot') { errors.push(`${where}: type має бути video або shot, зараз «${r.type}»`); return; }
  // імена й ніші не обов'язкові: на головній сторінці їх не видно
  for (const k of ['niche_ua', 'niche_ru']) if (r[k] && r[k] !== cap(r[k])) warns.push(`${where}: ${k} краще з великої літери («${r[k]}»); на сайті вона й так буде з великої`);

  if (r.type === 'video') {
    if (!r.media) { pending++; warns.push(`${where} (${r.name_ua}): відео ще без ID, на сайті його не буде`); return; }
    if (!GUID.test(r.media)) errors.push(`${where}: media для відео має бути ID з Bunny (формат xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), зараз «${r.media}»`);
    videos++;
  } else {
    if (!r.media) { errors.push(`${where}: для скріна не вказано файл`); return; }
    const f = path.join(SHOTS_DIR, r.media);
    if (!fs.existsSync(f)) { errors.push(`${where}: немає файлу public/assets/shots/${r.media}`); return; }
    shots++;
    if (!r.w || !r.h) {
      if (args.fix) { const s = imageSize(f); r.w = String(s.w); r.h = String(s.h); changed = true; }
      else warns.push(`${where}: немає ширини/висоти скріна, запусти npm run validate -- --fix`);
    }
    if (r.ring && !/^\d+(\.\d+)?( \d+(\.\d+)?){3}$/.test(r.ring)) errors.push(`${where}: ring має вигляд «лівий верхній ширина висота» у відсотках, наприклад «8 13 85 8»`);
  }
});

if (changed) { writeRows(rows); console.log('Розміри скрінів доповнено.'); }

function report() {
  warns.forEach((w) => console.log('  ⚠ ' + w));
  errors.forEach((e) => console.log('  ✖ ' + e));
  if (errors.length) { console.log(`\nПомилок: ${errors.length}. Деплой зупинено.`); process.exit(1); }
}
report();
console.log(`OK: відео ${videos}, скрінів ${shots}` + (pending ? `, відео без ID: ${pending}` : '') + `, усього карток на сайті: ${videos + shots}`);
