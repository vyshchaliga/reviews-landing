/* Анкета передзапису: картка стоїть прямо на сторінці, кнопки лише прокручують до неї.
   Попапа немає. Відповіді йдуть на /api/lead → Google-таблиця, після відправки — редірект у канал.
   Мова береться з перемикача UA/RU на ленді. Завантажується тільки на /pre-reg-form. */
(function () {
  'use strict';

  var CHANNEL_URL = 'https://t.me/+khBdwlzmHHBhNzIy';   // той самий канал, куди веде анкета на Tilda
  var API = '/api/lead';

  // Радіо-питання. v — значення, яке потрапляє в таблицю (як в анкеті на Tilda, російською); ua/ru — підписи.
  var GROUPS = [
    // multi: можна обрати кілька (у таблицю йдуть через кому); solo: варіант, що виключає інші
    { key: 'rol', t: 'role', multi: true, opts: [
      { v: 'Продюсер',                        ua: 'Продюсер',                         ru: 'Продюсер' },
      { v: 'Эксперт',                         ua: 'Експерт',                          ru: 'Эксперт' },
      { v: 'Маркетолог / в команде проекта',  ua: 'Маркетолог / у команді проєкту',   ru: 'Маркетолог / в команде проекта' },
      { v: 'Пока не в инфобизнесе',           ua: 'Поки не в інфобізнесі',            ru: 'Пока не в инфобизнесе', solo: true } ] }
  ];

  var T = {
    ua: {
      title1: 'ЗАПОВНИ АНКЕТУ –', title1a: 'ЗАПОВНИ', title1b: 'АНКЕТУ',
      title2: 'ОТРИМАЙ РОЗБІР СВОГО ПРОЄКТУ ТА УМОВИ ПРОГРАМИ',
      sub: 'Уважно перевір правильність даних, включно з ніком в інстаграмі та телеграмі.',
      name: 'Твоє ім’я', tg: 'Нік у телеграмі через @', ig: 'Нік в інстаграмі через @',
      income: 'Твій середній дохід на місяць?', role: 'Яка твоя роль', multi: 'можна обрати кілька',
      nisha: 'Твоя ніша',
      send: 'Відправити анкету', sending: 'Відправляємо…',
      need: 'Заповни, будь ласка, усі поля', fail: 'Не вдалося відправити анкету. Спробуй ще раз за хвилину.'
    },
    ru: {
      title1: 'ЗАПОЛНИ АНКЕТУ –', title1a: 'ЗАПОЛНИ', title1b: 'АНКЕТУ',
      title2: 'ПОЛУЧИ РАЗБОР СВОЕГО ПРОЕКТА И УСЛОВИЯ ПРОГРАММЫ',
      sub: 'Внимательно проверь правильность данных, включая ник в инстаграме и телеграме.',
      name: 'Твоё имя', tg: 'Ник в телеграме через @', ig: 'Ник в инстаграме через @',
      income: 'Твой средний доход в месяц?', role: 'Какая твоя роль', multi: 'можно выбрать несколько',
      nisha: 'Твоя ниша',
      send: 'Отправить анкету', sending: 'Отправляем…',
      need: 'Заполни, пожалуйста, все поля', fail: 'Не удалось отправить анкету. Попробуй ещё раз через минуту.'
    }
  };

  // На агентському і консалтинговому лендах замість питання про роль стоїть вільне поле «Ваша ниша»
  var NICHE = /^\/pre-reg-form-(?:agent|consult)(?:\/ua)?\/?$/.test(location.pathname);
  // Під яким типом анкета лягає в таблицю — по цьому полю потоки розділяються
  var LEAD_TYPE = /^\/pre-reg-form-consult(?:\/ua)?\/?$/.test(location.pathname) ? 'Предзапис консалт'
    : /^\/pre-reg-form-agent(?:\/ua)?\/?$/.test(location.pathname) ? 'Предзапис агенти'
    : 'Предзапис';

  var card, form, formView, done = false, busy = false;
  var refs = {};

  function lang() { return document.documentElement.lang === 'ru' ? 'ru' : 'ua'; }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }

  // Поле з «плаваючим» підписом: на телефоні підпис стоїть усередині поля і зсувається вгору, коли поле активне або заповнене
  // (на ПК підпис над полем, як раніше). Для ніків «@» підставляється сам, щоб було видно формат.
  function field(key, type, autocomplete, inputmode) {
    var wrap = el('div', 'rtg-f');
    var id = 'rtg-' + key;
    var l = el('label', 'rtg-l'); l.htmlFor = id;
    var i = el('input', 'rtg-in');
    i.id = id; i.name = key; i.type = type || 'text'; i.maxLength = 200;
    i.autocomplete = autocomplete || 'off';
    i.setAttribute('enterkeyhint', key === 'dohod' ? 'done' : 'next');
    if (inputmode) i.setAttribute('inputmode', inputmode);
    var nick = key === 'tg' || key === 'instagram';
    if (nick) { i.setAttribute('autocapitalize', 'none'); i.setAttribute('autocorrect', 'off'); i.spellcheck = false; }
    function sync() { wrap.classList.toggle('has', i.value !== ''); }
    i.addEventListener('focus', function () {
      if (nick && i.value === '') { i.value = '@'; try { i.setSelectionRange(1, 1); } catch (e) { /* ігноруємо */ } }
      sync();
    });
    i.addEventListener('blur', function () { if (nick && i.value === '@') i.value = ''; sync(); });
    i.addEventListener('input', function () {
      if (nick && /^@{2,}/.test(i.value)) i.value = i.value.replace(/^@+/, '@');   // людина за звичкою додала ще один «@»
      sync();
    });
    i.addEventListener('change', sync);
    i.addEventListener('keydown', function (e) {               // Enter = до наступного поля, а не відправка
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var all = Array.prototype.slice.call(form.querySelectorAll('.rtg-in'));
      var next = all[all.indexOf(i) + 1];
      if (next) next.focus(); else i.blur();
    });
    wrap.appendChild(i); wrap.appendChild(l);               // порядок важливий для CSS: спершу поле, потім підпис
    refs[key] = { wrap: wrap, label: l, input: i, sync: sync };
    return wrap;
  }

  function build() {
    card = el('div', 'rtg-card');

    formView = el('div', 'rtg-form');
    var h = el('h2', 'rtg-h d');
    var h1 = document.createElement('span'); var h2 = el('span', 'gold');
    if (NICHE) {
      // «Заполни [анкету]» — друге слово під маркером, як у заголовку на першому екрані
      var mk = el('span', 'mark mark-orange');
      h.appendChild(h1); h.appendChild(document.createTextNode(' ')); h.appendChild(mk);
      h.appendChild(document.createTextNode(' – ')); h.appendChild(h2);
      refs.mark = mk;
    } else {
      h.appendChild(h1); h.appendChild(document.createTextNode(' ')); h.appendChild(h2);
    }
    refs.h1 = h1; refs.h2 = h2; refs.h = h;
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
      var lg = el('legend', 'rtg-l');
      var lgT = document.createElement('span'); var lgH = el('span', 'rtg-hint');
      lg.appendChild(lgT); lg.appendChild(lgH); fs.appendChild(lg);
      var box = el('div', 'rtg-chips'); fs.appendChild(box);
      var items = [];
      g.opts.forEach(function (o) {
        var lab = el('label', 'rtg-opt');
        var inp = document.createElement('input'); inp.type = g.multi ? 'checkbox' : 'radio'; inp.name = g.key; inp.value = o.v;
        var dot = el('span', g.multi ? 'rtg-dot sq' : 'rtg-dot');
        var tx = document.createElement('span');
        lab.appendChild(inp); lab.appendChild(dot); lab.appendChild(tx);
        box.appendChild(lab);
        items.push({ opt: o, text: tx, input: inp, label: lab });
      });
      box.addEventListener('change', function (e) {
        var cur = items.filter(function (it) { return it.input === e.target; })[0];
        if (g.multi && cur && cur.input.checked) {
          // «Поки не в інфобізнесі» не поєднується з іншими ролями
          items.forEach(function (it) { if (it !== cur && (cur.opt.solo || it.opt.solo)) it.input.checked = false; });
        }
        items.forEach(function (it) { it.label.classList.toggle('on', it.input.checked); });
      });
      refs.groups[g.key] = { def: g, set: fs, legend: lgT, hint: lgH, items: items };
      return fs;
    }
    form.appendChild(field('dohod', 'text', 'off'));
    if (NICHE) form.appendChild(field('nisha', 'text', 'off'));
    else form.appendChild(group(GROUPS[0]));

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
    texts();
  }

  function texts() {
    if (!card) return;
    var t = T[lang()], lg = lang();
    if (NICHE) {
      refs.h1.textContent = t.title1a; refs.mark.textContent = t.title1b;
    } else {
      refs.h1.textContent = t.title1;
    }
    refs.h2.textContent = t.title2;
    refs.sub.textContent = t.sub;
    refs.name.label.textContent = t.name; refs.tg.label.textContent = t.tg;
    refs.instagram.label.textContent = t.ig; refs.dohod.label.textContent = t.income;
    if (NICHE) refs.nisha.label.textContent = t.nisha;
    if (!NICHE) GROUPS.forEach(function (g) {
      var G = refs.groups[g.key];
      G.legend.textContent = t[g.t];
      G.hint.textContent = g.multi ? t.multi : '';
      G.items.forEach(function (r) { r.text.textContent = r.opt[lg]; });
    });
    refs.go.textContent = busy ? t.sending : t.send;
    if (refs.msg.getAttribute('data-k')) refs.msg.textContent = t[refs.msg.getAttribute('data-k')];
    fitH(); refit();
  }

  /* Перший замір випадає на момент, коли шрифт ще не став на місце, і кегль
     лишається завеликим. Тому міряємо ще раз, коли шрифти доїхали. */
  var refitT;
  function refit() {
    clearTimeout(refitT); refitT = setTimeout(fitH, 350);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitH).catch(function () {});
  }

  /* Заголовок анкети має лишатись строго у двох рядках. Текст довгий, мов дві,
     а кегль на чотирьох лендах різний, тому не зашиваємо його в CSS, а міряємо на місці:
     беремо той розмір, що дав CSS, і зменшуємо, поки заголовок не вкладеться. */
  function fitH() {
    var h = refs.h; if (!h || !h.offsetHeight) return;
    h.style.fontSize = '';
    var max = Math.round(parseFloat(getComputedStyle(h).fontSize)) || 24;
    for (var px = max; px >= 10; px--) {
      h.style.fontSize = px + 'px';
      var lh = parseFloat(getComputedStyle(h).lineHeight) || px * 1.15;
      if (h.offsetHeight / lh < 2.5) return;   // 2 рядки з запасом на округлення
    }
  }

  function showMsg(k) {
    if (!k) { refs.msg.removeAttribute('data-k'); refs.msg.textContent = ''; return; }
    refs.msg.setAttribute('data-k', k); refs.msg.textContent = T[lang()][k];
  }

  /* Слот на першому екрані /pre-reg-form. Картка з анкетою одна і завжди тут:
     кнопки до неї прокручують, нікуди не переносять. */
  function slot() { return document.getElementById('prereg-slot'); }

  var FILLED = NICHE ? ['name', 'tg', 'instagram', 'dohod', 'nisha'] : ['name', 'tg', 'instagram', 'dohod'];

  function mountInline() {
    var s = slot();
    if (!s) return;
    if (!card) build();
    texts();
    formView.hidden = done;
    FILLED.forEach(function (k) { refs[k].sync(); });
    s.appendChild(card);
  }

  function atNick(v) {
    v = (v || '').replace(/\s+/g, '').replace(/^@+/, '');
    return v ? '@' + v : '';
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
    if (NICHE) {
      // у таблиці для ніші є своя колонка nisha, тому rol лишається порожнім
      data.nisha = refs.nisha.input.value.trim();
    } else {
      GROUPS.forEach(function (g) {
        data[g.key] = '';
        data[g.key] = refs.groups[g.key].items.filter(function (r) { return r.input.checked; })
          .map(function (r) { return r.opt.v; }).join(', ');
      });
    }

    var bad = false;
    var required = [['name', data.name], ['tg', data.nik_tg], ['instagram', data.instagram], ['dohod', data.dohod]];
    if (NICHE) required.push(['nisha', data.nisha]);
    required.forEach(function (p) {
      var empty = !p[1] || p[1] === '@';
      refs[p[0]].wrap.classList.toggle('err', empty); if (empty) bad = true;
    });
    if (!NICHE) GROUPS.forEach(function (g) {
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
    data.type = LEAD_TYPE;
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
      clearTimeout(to); busy = false; refs.go.disabled = false; finish(true);
    }).catch(function () {
      clearTimeout(to); busy = false; refs.go.disabled = false; texts(); showMsg('fail');
    });
  }

  /* Анкету прийнято — одразу ведемо в канал. Проміжного екрана з кнопкою
     і конфеті більше немає: людина має потрапити в канал без зайвого кроку. */
  function finish(real) {
    done = true;
    var go = function () { location.href = CHANNEL_URL; };
    // real — анкета справді пішла в таблицю: тоді віддаємо Lead у Meta Pixel.
    // Перехід чекає 300 мс, інакше браузер обриває запит піксела на вивантаженні.
    if (real && typeof window.fbq === 'function') {
      try { window.fbq('track', 'Lead', { content_name: LEAD_TYPE, content_category: lang() }); }
      catch (e) { go(); return; }
      setTimeout(go, 300);
      return;
    }
    go();
  }

  /* ---------- Підключення ---------- */
  document.addEventListener('vl:lang', texts);
  window.addEventListener('resize', fitH);

  // На /pre-reg-form анкета стоїть одразу на першому екрані
  if (slot()) setTimeout(mountInline, 0);
})();
