// Додає скрін відгука.
// node scripts/add-shot.mjs --file ./скрін.png --name-ua "Імʼя" --name-ru "Имя" --niche-ua "Ніша" --niche-ru "Ниша" [--ring "8 13 85 8"] [--position 4]
import fs from 'node:fs';
import path from 'node:path';
import { SHOTS_DIR, readRows, writeRows, parseArgs, insertRow, requireNames, cap } from './lib/common.mjs';
import { imageSize } from './lib/imgsize.mjs';

const a = parseArgs(process.argv.slice(2));
requireNames(a);
if (!a.file || !fs.existsSync(a.file)) { console.error('Вкажи існуючий файл: --file ./скрін.png'); process.exit(1); }

const ext = path.extname(a.file).toLowerCase().replace('.jpeg', '.jpg');
if (!['.png', '.jpg', '.webp'].includes(ext)) { console.error('Підтримуються png, jpg, webp'); process.exit(1); }

fs.mkdirSync(SHOTS_DIR, { recursive: true });
const used = fs.readdirSync(SHOTS_DIR).map((f) => parseInt((f.match(/^r(\d+)\./) || [])[1], 10)).filter(Number.isFinite);
const next = String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0');
const name = `r${next}${ext}`;            // нейтральна назва файлу: імен людей у адресах немає
fs.copyFileSync(a.file, path.join(SHOTS_DIR, name));
const { w, h } = imageSize(path.join(SHOTS_DIR, name));

const rows = readRows();
insertRow(rows, {
  type: 'shot', media: name, w, h,
  name_ua: a['name-ua'], name_ru: a['name-ru'],
  niche_ua: cap(a['niche-ua']), niche_ru: cap(a['niche-ru']),
  ring: a.ring && a.ring !== true ? a.ring : ''
}, a.position);
writeRows(rows);
console.log(`Додано скрін ${name} (${w}×${h}). Далі: npm run validate, потім commit і push.`);
