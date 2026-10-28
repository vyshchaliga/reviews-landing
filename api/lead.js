// Приймає анкету з попапа /rtg і передає її в Google Apps Script, який дописує рядок у таблицю.
// Налаштування (Vercel → Project → Settings → Environment Variables):
//   SHEETS_WEBHOOK_URL — адреса веб-застосунку Apps Script (закінчується на /exec)
//   SHEETS_SECRET      — той самий секрет, що в скрипті (scripts/apps-script/Code.gs)
const FIELDS = ['name', 'nik_tg', 'instagram', 'dohod', 'rol', 'nisha', 'type', 'lang', 'referer',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const AGENT_TYPE = 'Предзапис агенти';   // ленд для агентств: замість ролі зі списку — вільний текст ніші
const OPTIONS = {
  rol: ['Продюсер', 'Эксперт', 'Маркетолог / в команде проекта', 'Пока не в инфобизнесе']   // можна кілька, через «, »
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }

  // Тільки з нашого сайту
  const origin = req.headers.origin || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  if (origin) {
    try { if (new URL(origin).host !== host) return res.status(403).json({ ok: false }); }
    catch { return res.status(403).json({ ok: false }); }
  }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ ok: false, error: 'bad body' });

  if (b.website) return res.status(200).json({ ok: true });   // пастка для ботів

  const clean = {};
  for (const k of FIELDS) {
    let v = b[k] == null ? '' : String(b[k]).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, k === 'referer' ? 500 : 200);
    if (/^[=+\-]/.test(v)) v = "'" + v;                       // щоб таблиця не сприйняла текст як формулу
    clean[k] = v;
  }
  const agent = String(b.type || '') === AGENT_TYPE;
  const choicesOk = Object.keys(OPTIONS).every((k) => {
    const parts = String(b[k] || '').split(', ');
    return parts.length > 0 && new Set(parts).size === parts.length && parts.every((x) => OPTIONS[k].includes(x));
  });
  if (!clean.name || !clean.nik_tg || !clean.instagram || !clean.dohod ||
      (agent ? !clean.nisha : !choicesOk)) {
    return res.status(400).json({ ok: false, error: 'missing fields' });
  }
  clean.type = clean.type || 'Предзапис';

  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return res.status(503).json({ ok: false, error: 'not configured' });

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: process.env.SHEETS_SECRET || '', data: clean }),
      redirect: 'follow',
      signal: ctl.signal
    });
    clearTimeout(t);
    const txt = await r.text();
    let j = {}; try { j = JSON.parse(txt); } catch { /* відповідь не JSON */ }
    if (!r.ok || !j.ok) return res.status(502).json({ ok: false, error: 'sheet' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: 'sheet' });
  }
}
