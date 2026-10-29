// Збирає українську сторінку агентського передзапису з російської.
// Розмітка одна на дві адреси, тексти — у словнику нижче, тому /pre-reg-form-agent
// і /pre-reg-form-agent/ua не можуть розійтись ані структурою, ані словами.
// На самому ленді словник не потрібен: мова там прибита до адреси.
// Запускається перед кожним деплоєм з validate.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public', 'pre-reg-form-agent.html');
const OUT = path.join(ROOT, 'public', 'pre-reg-form-agent', 'ua.html');

// Ключі збігаються з data-a18n у розмітці; pageTitle і pageDesc ідуть у <head>.
const UA = {
  pageTitle: 'Анкета передзапису — Вища Ліга 6.0 для агенцій',
  pageDesc: 'Анкета передзапису на шостий потік програми «Вища Ліга» для агентського бізнесу.',
  brand: 'Вища Ліга 6.0',
  qual: 'Преміальна програма з масштабування info/digital/agency-бізнесів',
  h1a: 'Зроби',
  h1b: 'прорив',
  h1c: 'в агентському бізнесі у 2027',
  bonusA: 'Заповни анкету до',
  bonusB: 'і гарантовано забери бонус',
  bonusN: '«<b>Система</b> залучення клієнтів, яка приносить <b>$20-50К на місяць</b>»',
  offerCta: 'Дізнатися деталі програми',
  wallA: 'Результати учасників',
  wallB: 'Вища Ліга',
  cta: 'Залишити анкету',
};

// У bonusN є <b> навколо акцентних слів — це розмітка, а не текст, тож не екрануємо.
const RAW = new Set(['bonusN']);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildAgentUaPage() {
  let page = fs.readFileSync(SRC, 'utf8');
  const was = page;

  page = page.replace('<html lang="ru"', '<html lang="uk"');
  page = page.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(UA.pageTitle)}</title>`);
  page = page.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(UA.pageDesc)}$2`);
  page = page.replace('aria-label="Бонус предзаписи"', 'aria-label="Бонус передзапису"');

  // перемикач дзеркалимо: активна тут українська, посилання веде на російську
  page = page.replace(
    /<!-- Мова прибита[\s\S]*?<\/div>/,
    [
      '<!-- Мова прибита до адреси: ця сторінка тільки українська, RU веде на /pre-reg-form-agent -->',
      '      <div class="langs" role="group" aria-label="Language">',
      '        <span class="lang on" aria-current="true">UA</span>',
      '        <span class="lang-sep">|</span>',
      '        <a class="lang" href="/pre-reg-form-agent" hreflang="ru">RU</a>',
      '      </div>',
    ].join('\n')
  );

  const missing = [];
  const was_ru = [];
  page = page.replace(
    /(<(\w+)(?:\s[^>]*)?\sdata-a18n="([^"]+)"(?:\s[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
    (all, open, tag, key, inner) => {
      if (UA[key] == null) { missing.push(key); return all; }
      was_ru.push(inner.trim());
      return open + (RAW.has(key) ? UA[key] : esc(UA[key])) + `</${tag}>`;
    }
  );
  if (missing.length) throw new Error(`у словнику немає ключів: ${missing.join(', ')}`);
  if (page === was) throw new Error('українська сторінка вийшла байт у байт як російська — заміни не спрацювали');

  // жоден російський рядок не мав лишитись у видимому тексті
  const body = page.replace(/<!--[\s\S]*?-->/g, '');
  const left = was_ru.filter((s) => s && body.includes(s));
  if (left.length) throw new Error(`в українській сторінці лишився російський текст: ${left.join(' / ')}`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (old !== page) fs.writeFileSync(OUT, page);
  return { changed: old !== page, keys: Object.keys(UA).length };
}

if (process.argv[1]?.endsWith('build-agent-ua-page.mjs')) {
  const r = buildAgentUaPage();
  console.log(`public/pre-reg-form-agent/ua.html ${r.changed ? 'оновлено' : 'без змін'}, рядків у словнику: ${r.keys}`);
}
