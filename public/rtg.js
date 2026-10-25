/* Версія /rtg (ретаргет): кнопка «Хочу у Вищу Лігу» відкриває попап-анкету.
   Відповіді йдуть на /api/lead → Google-таблиця. Після відправки — конфеті й кнопка в канал передзапису.
   Мова береться з перемикача UA/RU на ленді. Завантажується тільки на /rtg. */
(function () {
  'use strict';

  var CHANNEL_URL = 'https://t.me/+khBdwlzmHHBhNzIy';   // той самий канал, куди веде анкета на Tilda
  var API = '/api/lead';

  // Радіо-питання. v — значення, яке потрапляє в таблицю (як в анкеті на Tilda, російською); ua/ru — підписи.
  var GROUPS = [
    { key: 'podpiska', t: 'podpiska', opts: [
      { v: 'Около месяца',       ua: 'Приблизно місяць',     ru: 'Около месяца' },
      { v: 'До 3-4 месяцев',     ua: 'До 3–4 місяців',       ru: 'До 3-4 месяцев' },
      { v: 'Около полугода',     ua: 'Приблизно пів року',   ru: 'Около полугода' },
      { v: 'Чуть меньше года',   ua: 'Трохи менше року',     ru: 'Чуть меньше года' },
      { v: 'Больше года',        ua: 'Більше року',          ru: 'Больше года' } ] },
    { key: 'rol', t: 'role', opts: [
      { v: 'Продюсер',                        ua: 'Продюсер',                         ru: 'Продюсер' },
      { v: 'Эксперт',                         ua: 'Експерт',                          ru: 'Эксперт' },
      { v: 'И эксперт, и продюсер',           ua: 'І експерт, і продюсер',            ru: 'И эксперт, и продюсер' },
      { v: 'Маркетолог / в команде проекта',  ua: 'Маркетолог / у команді проєкту',   ru: 'Маркетолог / в команде проекта' },
      { v: 'Пока не в инфобизнесе',           ua: 'Поки не в інфобізнесі',            ru: 'Пока не в инфобизнесе' } ] },
    { key: 'interes', t: 'interes', opts: [
      { v: 'Готов заходить на поток',  ua: 'Готовий заходити на потік', ru: 'Готов заходить на поток' },
      { v: 'Еще сомневаюсь',           ua: 'Ще сумніваюсь',             ru: 'Еще сомневаюсь' },
      { v: 'Не заинтересован',         ua: 'Не зацікавлений',           ru: 'Не заинтересован' } ] }
  ];

  var T = {
    ua: {
      title1: 'Анкета', title2: 'передзапису',
      sub: 'Уважно перевірте правильність даних, включно з ніком в інстаграмі та телеграмі.',
      name: 'Ваше ім’я', tg: 'Нік у телеграмі через @', ig: 'Нік в інстаграмі через @',
      income: 'Ваш середній дохід на місяць?', role: 'Яка ваша роль',
      podpiska: 'Як давно підписані на мене?', interes: 'Наскільки ви зацікавлені в участі у Вищій Лізі?',
      send: 'Відправити анкету', sending: 'Відправляємо…',
      need: 'Заповніть, будь ласка, усі поля', fail: 'Не вдалося відправити анкету. Спробуйте ще раз за хвилину.',
      okTitle: 'Ваша анкета прийнята', okText: 'Запрошуємо в канал передзапису', okBtn: 'У канал передзапису',
      close: 'Закрити'
    },
    ru: {
      title1: 'Анкета', title2: 'предзаписи',
      sub: 'Внимательно проверьте правильность данных, включая ник в инстаграмме и телеграмме.',
      name: 'Ваше имя', tg: 'Ник в телеграмм через @', ig: 'Ник в инстаграмм через @',
      income: 'Ваш средний доход в месяц?', role: 'Какая ваша роль',
      podpiska: 'Как давно подписаны на меня?', interes: 'Насколько вы заинтересованы в участии в Высшей Лиге?',
      send: 'Отправить анкету', sending: 'Отправляем…',
      need: 'Заполните, пожалуйста, все поля', fail: 'Не удалось отправить анкету. Попробуйте ещё раз через минуту.',
      okTitle: 'Ваша анкета принята', okText: 'Приглашаем в канал предзаписи', okBtn: 'В канал предзаписи',
      close: 'Закрыть'
    }
  };

  var ov, card, form, okView, formView, lastFocus, done = false, busy = false;
  var refs = {};

  function lang() { return document.documentElement.lang === 'ru' ? 'ru' : 'ua'; }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function svgEl(vb, d, extra) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', vb); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', extra || '#fff');
    p.setAttribute('stroke-width', '2.4'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p); return s;
  }

  function field(key, type, autocomplete, inputmode) {
    var wrap = el('div', 'rtg-f');
    var id = 'rtg-' + key;
    var l = el('label', 'rtg-l'); l.htmlFor = id;
    var i = el('input', 'rtg-in');
    i.id = id; i.name = key; i.type = type || 'text'; i.maxLength = 200;
    i.autocomplete = autocomplete || 'off';
    if (inputmode) i.setAttribute('inputmode', inputmode);
    if (key === 'tg' || key === 'instagram') { i.setAttribute('autocapitalize', 'none'); i.setAttribute('autocorrect', 'off'); i.spellcheck = false; i.placeholder = '@'; }
    wrap.appendChild(l); wrap.appendChild(i);
    refs[key] = { wrap: wrap, label: l, input: i };
    return wrap;
  }

  function build() {
    ov = el('div', 'rtg-ov');
    card = el('div', 'rtg-card');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.tabIndex = -1;

    var x = el('button', 'rtg-x'); x.type = 'button';
    x.appendChild(svgEl('0 0 16 16', 'M2 2l12 12M14 2L2 14'));
    x.addEventListener('click', close);
    refs.x = x;
    card.appendChild(x);

    formView = el('div', 'rtg-form');
    var h = el('h2', 'rtg-h d');
    var h1 = document.createElement('span'); var h2 = el('span', 'gold');
    h.appendChild(h1); h.appendChild(document.createTextNode(' ')); h.appendChild(h2);
    refs.h1 = h1; refs.h2 = h2;
    card.setAttribute('aria-labelledby', 'rtg-title'); h.id = 'rtg-title';
    var sub = el('p', 'rtg-sub'); refs.sub = sub;
    formView.appendChild(h); formView.appendChild(sub);

    form = el('form'); form.noValidate = true;
    form.appendChild(field('name', 'text', 'name'));
    form.appendChild(field('tg', 'text', 'off'));
    form.appendChild(field('instagram', 'text', 'off'));
    refs.groups = {};
    function group(g) {
      var fs = el('fieldset', 'rtg-fs');
      var lg = el('legend', 'rtg-l'); fs.appendChild(lg);
      var items = [];
      g.opts.forEach(function (o) {
        var lab = el('label', 'rtg-opt');
        var inp = document.createElement('input'); inp.type = 'radio'; inp.name = g.key; inp.value = o.v;
        var dot = el('span', 'rtg-dot');
        var tx = document.createElement('span');
        lab.appendChild(inp); lab.appendChild(dot); lab.appendChild(tx);
        fs.appendChild(lab);
        items.push({ opt: o, text: tx, input: inp });
      });
      refs.groups[g.key] = { def: g, set: fs, legend: lg, items: items };
      return fs;
    }
    form.appendChild(group(GROUPS[0]));
    form.appendChild(field('dohod', 'text', 'off'));
    form.appendChild(group(GROUPS[1]));
    form.appendChild(group(GROUPS[2]));

    // Пастка для ботів: людина це поле не бачить
    var hp = el('div', 'rtg-hp'); hp.setAttribute('aria-hidden', 'true');
    var hpi = document.createElement('input'); hpi.type = 'text'; hpi.name = 'website'; hpi.tabIndex = -1; hpi.autocomplete = 'off';
    hp.appendChild(hpi); form.appendChild(hp); refs.hp = hpi;

    var msg = el('div', 'rtg-msg'); msg.setAttribute('role', 'alert'); refs.msg = msg;
    form.appendChild(msg);
    var go = el('button', 'btn rtg-go'); go.type = 'submit'; refs.go = go;
    form.appendChild(go);
    form.addEventListener('submit', onSubmit);
    function clearErr(e) {
      var n = e.target.closest && e.target.closest('.rtg-f,.rtg-fs');
      if (n) n.classList.remove('err');
      if (!card.querySelector('.err')) showMsg(null);
    }
    form.addEventListener('input', clearErr); form.addEventListener('change', clearErr);
    formView.appendChild(form);
    card.appendChild(formView);

    // Екран успіху
    okView = el('div', 'rtg-ok'); okView.hidden = true;
    var tick = el('div', 'rtg-tick'); tick.appendChild(svgEl('0 0 36 36', 'M7 19l8 8 14-16'));
    var oh = el('h2', 'rtg-h d'); refs.okTitle = oh;
    var op = el('p'); refs.okText = op;
    var ob = el('a', 'btn'); ob.href = CHANNEL_URL; refs.okBtn = ob;
    okView.appendChild(tick); okView.appendChild(oh); okView.appendChild(op); okView.appendChild(ob);
    card.appendChild(okView);

    ov.appendChild(card);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    texts();
  }

  function texts() {
    if (!ov) return;
    var t = T[lang()], lg = lang();
    refs.h1.textContent = t.title1; refs.h2.textContent = t.title2;
    refs.sub.textContent = t.sub;
    refs.name.label.textContent = t.name; refs.tg.label.textContent = t.tg;
    refs.instagram.label.textContent = t.ig; refs.dohod.label.textContent = t.income;
    GROUPS.forEach(function (g) {
      var G = refs.groups[g.key];
      G.legend.textContent = t[g.t];
      G.items.forEach(function (r) { r.text.textContent = r.opt[lg]; });
    });
    refs.go.textContent = busy ? t.sending : t.send;
    refs.x.setAttribute('aria-label', t.close);
    refs.okTitle.textContent = t.okTitle; refs.okText.textContent = t.okText; refs.okBtn.textContent = t.okBtn;
    if (refs.msg.getAttribute('data-k')) refs.msg.textContent = t[refs.msg.getAttribute('data-k')];
  }

  function showMsg(k) {
    if (!k) { refs.msg.removeAttribute('data-k'); refs.msg.textContent = ''; return; }
    refs.msg.setAttribute('data-k', k); refs.msg.textContent = T[lang()][k];
  }

  function open() {
    if (!ov) build();
    texts();
    lastFocus = document.activeElement;
    formView.hidden = done; okView.hidden = !done;
    document.documentElement.classList.add('rtg-lock');
    // поки елемент не показаний, перехід не спрацює: даємо браузеру один кадр
    requestAnimationFrame(function () {
      ov.classList.add('on');
      var touch = document.documentElement.classList.contains('touch');
      if (!touch && !done) refs.name.input.focus(); else card.focus();
    });
  }

  function close() {
    if (!ov) return;
    ov.classList.remove('on');
    document.documentElement.classList.remove('rtg-lock');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ігноруємо */ } }
  }

  function isOpen() { return ov && ov.classList.contains('on'); }

  function atNick(v) {
    v = (v || '').replace(/\s+/g, '');
    if (!v) return '';
    return v.charAt(0) === '@' ? v : '@' + v;
  }

  function utm() {
    var q = new URLSearchParams(location.search), o = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { o[k] = (q.get(k) || '').slice(0, 200); });
    return o;
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    var data = {
      name: refs.name.input.value.trim(),
      nik_tg: atNick(refs.tg.input.value),
      instagram: atNick(refs.instagram.input.value),
      dohod: refs.dohod.input.value.trim()
    };
    GROUPS.forEach(function (g) {
      data[g.key] = '';
      refs.groups[g.key].items.forEach(function (r) { if (r.input.checked) data[g.key] = r.opt.v; });
    });

    var bad = false;
    [['name', data.name], ['tg', data.nik_tg], ['instagram', data.instagram], ['dohod', data.dohod]].forEach(function (p) {
      var empty = !p[1] || p[1] === '@';
      refs[p[0]].wrap.classList.toggle('err', empty); if (empty) bad = true;
    });
    GROUPS.forEach(function (g) {
      refs.groups[g.key].set.classList.toggle('err', !data[g.key]); if (!data[g.key]) bad = true;
    });
    if (bad) {
      showMsg('need');
      var first = card.querySelector('.err input'); if (first && first.focus) first.focus();
      return;
    }
    showMsg(null);
    if (refs.hp.value) { finish(); return; }           // бот: вдаємо, що все добре, нічого не шлемо

    data.website = '';
    data.referer = location.href.slice(0, 500);
    var u = utm(); for (var k in u) data[k] = u[k];
    data.type = 'Предзапис';
    data.lang = lang();

    busy = true; refs.go.disabled = true; texts();
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data), signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json().catch(function () { return {}; });
    }).then(function () {
      clearTimeout(to); busy = false; refs.go.disabled = false; finish();
    }).catch(function () {
      clearTimeout(to); busy = false; refs.go.disabled = false; texts(); showMsg('fail');
    });
  }

  function finish() {
    done = true;
    texts();
    formView.hidden = true; okView.hidden = false;
    card.scrollTop = 0; card.focus();
    confetti();
  }

  /* ---------- Конфеті: чорне, золоте, біле — з лівого й правого боків, знизу і зверху ---------- */
  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = el('canvas', 'rtg-conf');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');
    if (!ctx) { cv.remove(); return; }
    ctx.scale(dpr, dpr);

    var COLORS = ['#0B0B0B', '#0B0B0B', '#E3B877', '#C9954F', '#F6D9A0', '#FFFFFF', '#FFFFFF'];
    var parts = [];
    var small = W < 600;
    function burst(x, y, a0, a1, n, speed) {
      for (var i = 0; i < n; i++) {
        var a = a0 + Math.random() * (a1 - a0), v = speed * (0.55 + Math.random() * 0.6);
        parts.push({
          x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
          c: COLORS[(Math.random() * COLORS.length) | 0], t: 0, life: 150 + Math.random() * 70, ph: Math.random() * 6.28
        });
      }
    }
    var PI = Math.PI, sp = small ? 17 : 24, n = small ? 46 : 70;
    burst(-10, H * 0.72, -PI * 0.42, -PI * 0.14, n, sp);        // зліва вгору-вправо
    burst(W + 10, H * 0.72, -PI * 0.86, -PI * 0.58, n, sp);     // справа вгору-вліво
    burst(W * 0.5, H + 10, -PI * 0.65, -PI * 0.35, n, sp * 1.15); // знизу по центру
    setTimeout(function () {                                    // друга хвиля + «дощ» зверху
      burst(-10, H * 0.55, -PI * 0.38, -PI * 0.1, n * 0.7, sp);
      burst(W + 10, H * 0.55, -PI * 0.9, -PI * 0.62, n * 0.7, sp);
      for (var i = 0; i < (small ? 30 : 50); i++) burst(Math.random() * W, -20, PI * 0.35, PI * 0.65, 1, 3 + Math.random() * 3);
    }, 380);

    var last = performance.now();
    function frame(now) {
      var dt = Math.min((now - last) / 16.67, 2.5); last = now;
      ctx.clearRect(0, 0, W, H);
      var alive = 0;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.t += dt; if (p.t > p.life) continue;
        alive++;
        p.vx *= Math.pow(0.975, dt); p.vy = p.vy * Math.pow(0.975, dt) + 0.42 * dt;
        p.x += p.vx * dt + Math.sin(p.t * 0.09 + p.ph) * 0.6; p.y += p.vy * dt; p.r += p.vr * dt;
        var fade = p.t > p.life - 40 ? Math.max(0, (p.life - p.t) / 40) : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.scale(1, Math.cos(p.t * 0.17 + p.ph));              // «переворот» аркуша
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        if (p.c === '#0B0B0B') { ctx.strokeStyle = 'rgba(255,235,200,0.45)'; ctx.lineWidth = 1; ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      }
      if (alive) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Підключення ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#cta-link');
    if (!a) return;
    e.preventDefault();
    open();
  });
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {                                        // утримуємо фокус у попапі
      var f = Array.prototype.filter.call(card.querySelectorAll('button,input,a[href]'), function (n) { return n.offsetParent !== null && n.tabIndex !== -1; });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('vl:lang', texts);
  // Кнопка могла бути натиснута до завантаження цього файла: тоді вона вже повела б на основний ленд, тому тут нічого не лишаємо
})();
