// Збирає українську сторінку передзапису з російської.
// Розмітка одна на дві адреси, тексти беруться з того самого словника, що й на клієнті,
// тому /pre-reg-form і /pre-reg-form/ua не можуть розійтись ані структурою, ані словами.
// Запускається перед кожним деплоєм з validate.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public', 'pre-reg-form.html');
const OUT = path.join(ROOT, 'public', 'pre-reg-form', 'ua.html');
const DICT = path.join(ROOT, 'public', 'prereg.js');

/** Дістає українські рядки з словника prereg.js: він лишається єдиним джерелом правди. */
function readUaDict() {
  const js = fs.readFileSync(DICT, 'utf8');
  const start = js.indexOf('\n    ua: {');
  if (start < 0) throw new Error('у prereg.js не знайдено блоку ua: { … }');
  const open = js.indexOf('{', start);
  let depth = 0, end = -1;
  for (let i = open; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}') { depth--; if (!depth) { end = i; break; } }
  }
  if (end < 0) throw new Error('у prereg.js не закрито блок ua: { … }');

  const body = js.slice(open + 1, end);
  const dict = {};
  const re = /(\w+)\s*:\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(body))) dict[m[1]] = m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'");
  if (!Object.keys(dict).length) throw new Error('у блоці ua: { … } не розібрано жодного рядка');
  return dict;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// \n у словнику = жорсткий перенос, так само як це робить prereg.js у браузері
const html = (s) => esc(s).split('\n').join('<br>');

export function buildUaPage() {
  const t = readUaDict();
  const need = ['pageTitle', 'pageDesc'];
  for (const k of need) if (!t[k]) throw new Error(`у словнику ua немає ключа «${k}»`);

  let page = fs.readFileSync(SRC, 'utf8');
  const was = page;

  page = page.replace('<html lang="ru"', '<html lang="uk"');
  page = page.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t.pageTitle)}</title>`);
  page = page.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(t.pageDesc)}$2`);
  page = page.replace('aria-label="Бонус предзаписи"', 'aria-label="Бонус передзапису"');

  // перемикач дзеркалимо: активна тут українська, посилання веде на російську
  page = page.replace(
    /<!-- Мова прибита[\s\S]*?<\/div>\n(\s*)<\/div>/,
    [
      '<!-- Мова прибита до адреси: ця сторінка тільки українська, RU веде на /pre-reg-form -->',
      '      <div class="langs" role="group" aria-label="Language">',
      '        <span class="lang on" aria-current="true">UA</span>',
      '        <span class="lang-sep">|</span>',
      '        <a class="lang" href="/pre-reg-form" hreflang="ru">RU</a>',
      '      </div>',
      '$1</div>',
    ].join('\n')
  );

  // тексти в розмітці — це те, що видно до старту скриптів, тому вони теж мають бути українські
  const missing = [];
  page = page.replace(
    /(<(\w+)(?:\s[^>]*)?\sdata-p18n="([^"]+)"(?:\s[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
    (all, open, tag, key, inner, close) => {
      if (t[key] == null) { missing.push(key); return all; }
      return open + html(t[key]) + close;
    }
  );
  if (missing.length) throw new Error(`у словнику ua немає ключів: ${missing.join(', ')}`);
  if (page === was) throw new Error('українська сторінка вийшла байт у байт як російська — заміни не спрацювали');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (old !== page) fs.writeFileSync(OUT, page);
  return { changed: old !== page, keys: Object.keys(t).length };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build-ua-page.mjs')) {
  const r = buildUaPage();
  console.log(`public/pre-reg-form/ua.html ${r.changed ? 'оновлено' : 'без змін'}, рядків у словнику: ${r.keys}`);
}
