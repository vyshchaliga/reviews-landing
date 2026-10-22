// Додає відео-відгук.
// Варіант А: відео вже завантажене в Bunny вручну, є його ID (Manage library → відео → Video ID / GUID):
//   node scripts/add-video.mjs --id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx --name-ua ... --name-ru ... --niche-ua ... --niche-ru ... [--position 4]
// Варіант Б: завантажити файл у Bunny цим скриптом (потрібен .env з BUNNY_API_KEY):
//   node scripts/add-video.mjs --file ./відео.mp4 --name-ua ... (решта як вище)
import fs from 'node:fs';
import { loadEnv, readRows, writeRows, parseArgs, insertRow, requireNames, cap } from './lib/common.mjs';

loadEnv();
const a = parseArgs(process.argv.slice(2));
requireNames(a);

const LIB = process.env.BUNNY_LIBRARY_ID || '786703';
const KEY = process.env.BUNNY_API_KEY;
const API = 'https://video.bunnycdn.com/library/' + LIB + '/videos';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let id = a.id && a.id !== true ? a.id : null;

if (!id) {
  if (!a.file || !fs.existsSync(a.file)) { console.error('Вкажи --id (вже завантажене відео) або --file ./відео.mp4'); process.exit(1); }
  if (!KEY) { console.error('Немає BUNNY_API_KEY. Створи файл .env за зразком .env.example'); process.exit(1); }
  const headers = { AccessKey: KEY, accept: 'application/json' };

  // Назва у Bunny нейтральна: імені людини там не буде
  const created = await fetch(API, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'review-' + Date.now() }) });
  if (!created.ok) { console.error('Bunny не створив відео:', created.status, await created.text()); process.exit(1); }
  id = (await created.json()).guid;

  const size = fs.statSync(a.file).size;
  console.log(`Завантажую ${(size / 1048576).toFixed(1)} МБ у Bunny…`);
  const up = await fetch(`${API}/${id}`, {
    method: 'PUT', headers: { AccessKey: KEY, 'content-type': 'application/octet-stream', 'content-length': String(size) },
    body: fs.createReadStream(a.file), duplex: 'half'
  });
  if (!up.ok) { console.error('Завантаження не вдалось:', up.status, await up.text()); process.exit(1); }
  console.log('Завантажено, Bunny кодує відео (зазвичай 1–3 хвилини).');
}

if (!GUID.test(id)) { console.error('ID має бути у форматі GUID: ' + id); process.exit(1); }

const rows = readRows();
if (rows.some((r) => r.type === 'video' && r.media === id)) { console.error('Таке відео вже є в таблиці.'); process.exit(1); }

// Якщо в таблиці вже є рядок цієї людини без ID, заповнюємо його замість додавання дубля
const same = rows.find((r) => r.type === 'video' && !r.media && r.name_ua === a['name-ua'] && cap(r.niche_ua) === cap(a['niche-ua']));
if (same && !a.position) { same.media = id; console.log('Заповнено ID у наявному рядку для ' + same.name_ua); }
else insertRow(rows, {
  type: 'video', media: id, w: '', h: '',
  name_ua: a['name-ua'], name_ru: a['name-ru'],
  niche_ua: cap(a['niche-ua']), niche_ru: cap(a['niche-ru']), ring: ''
}, a.position);
writeRows(rows);

// Невелика перевірка статусу кодування (не блокує)
if (KEY) {
  try {
    const s = await fetch(`${API}/${id}`, { headers: { AccessKey: KEY, accept: 'application/json' } });
    const j = await s.json();
    const names = { 0: 'створено', 1: 'завантажено', 2: 'обробка', 3: 'кодування', 4: 'готово', 5: 'помилка', 6: 'збій завантаження' };
    console.log('Статус у Bunny: ' + (names[j.status] ?? j.status));
  } catch { /* не критично */ }
}
console.log('Додано відео ' + id + '. Далі: npm run validate, потім commit і push.');
