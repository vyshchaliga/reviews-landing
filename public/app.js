/* Стіна відгуків «Вища Ліга».
   Дані беруться з data/reviews.csv. Відео — з Bunny Stream (HLS), програється власним плеєром без стороннього інтерфейсу.
   Жодних посилань назовні, крім кнопки «Хочу у Вищу Лігу». */
(function () {
  'use strict';

  var C = window.SITE_CONFIG || {};
  var CDN = C.bunnyCdn;

  var DICT = {
    ua: {
      title: 'Що говорять учасники про Вищу Лігу',
      desc: 'Відгуки учасників програми «Вища Ліга».',
      h1a: 'Що говорять', h1b: 'учасники', h1bg: 'про', h1c: 'Вищу Лігу',
      cta: 'Хочу у Вищу Лігу',
      s1n: '$8 000 000+', s1c: 'сумарно заробили наші учасники на своїх запусках за весь час існування Ліги',
      s2n: '5 ПОТОКІВ', s2c: 'системної роботи та перевіреної методології, яка дає стабільний результат',
      s3n: '250+ УЧАСНИКІВ', s3c: 'які вже пройшли програму, серед яких є найсильніші експерти та продюсери ринку',
      s4n: '50+ РІЗНИХ НІШ', s4c: 'у яких наші інструменти допомогли вирости в доході та побудувати систему',
      zoom: 'Збільшити відгук',
      play: 'Відтворити', pause: 'Пауза', soundOn: 'Увімкнути звук', soundOff: 'Вимкнути звук'
    },
    ru: {
      title: 'Что говорят участники о Высшей Лиге',
      desc: 'Отзывы участников программы «Высшая Лига».',
      h1a: 'Что говорят', h1b: 'участники', h1bg: 'о', h1c: 'Высшей Лиге',
      cta: 'Хочу в Высшую Лигу',
      s1n: '$8 000 000+', s1c: 'суммарно заработали наши участники на своих запусках за всё время существования Лиги',
      s2n: '5 ПОТОКОВ', s2c: 'системной работы и проверенной методологии, которая даёт стабильный результат',
      s3n: '250+ УЧАСТНИКОВ', s3c: 'которые уже прошли программу, среди которых сильнейшие эксперты и продюсеры рынка',
      s4n: '50+ РАЗНЫХ НИШ', s4c: 'в которых наши инструменты помогли вырасти в доходе и построить систему',
      zoom: 'Увеличить отзыв',
      play: 'Воспроизвести', pause: 'Пауза', soundOn: 'Включить звук', soundOff: 'Выключить звук'
    }
  };

  var state = {
    lang: 'ua',
    muted: true,       // глобальний стан звуку (для телефона)
    touch: false,
    cards: [],         // { row, reel, video, nameEl, nicheEl, ... }
    rows: [],          // рядки, що пішли в стрічку (для зациклення на телефоні)
    videos: [],        // картки з відео, за якими стежимо
    batches: [],       // дописані порції стрічки (телефон)
    nextIndex: 0,
    current: null      // картка, що зараз грає
  };

  /* Передзапис живе на кількох адресах: /pre-reg-form і /pre-reg-form-agent — російські,
     /pre-reg-form/ua і /pre-reg-form-agent/ua — українські, /pre-reg-form-consult — консалтинг
     (поки тільки російський).
     Мова прибита до адреси, тому ні ?lang, ні збережений вибір на неї не впливають. */
  function isPrereg() { return /^\/pre-reg-form(?:-agent|-consult)?(?:\/ua)?\/?$/.test(location.pathname); }
  function isPreregUa() { return /^\/pre-reg-form(?:-agent)?\/ua\/?$/.test(location.pathname); }

  /* ---------- Мова ---------- */
  function pickLang() {
    if (isPreregUa()) return 'ua';
    if (isPrereg()) return 'ru';
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'ua' || q === 'ru') return q;
    } catch (e) {}
    try {
      var saved = localStorage.getItem('vl_lang');
      if (saved === 'ua' || saved === 'ru') return saved;
    } catch (e) {}
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'uk'];
    var first = String(langs[0] || 'uk').toLowerCase();
    return first.indexOf('ru') === 0 ? 'ru' : 'ua';
  }

  function cap(s) { s = (s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function applyLang(lang) {
    state.lang = lang;
    var t = DICT[lang];
    // мову ставимо ДО події: слухачі (анкета, офер передзапису) читають її саме звідси,
    // інакше вони перемальовуються в попередню мову
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uk';
    try { document.dispatchEvent(new CustomEvent('vl:lang', { detail: lang })); } catch (e) { /* старі браузери */ }
    // у передзапису свої заголовок і опис — вони вже написані потрібною мовою в розмітці
    if (!isPrereg()) {
      document.title = t.title;
      // опис сторінки видно в прев'ю посилання, тому він теж іде за мовою
      var md = document.querySelector('meta[name="description"]');
      if (md && t.desc) md.setAttribute('content', t.desc);
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (n) {
      var k = n.getAttribute('data-i18n');
      if (t[k] != null) n.textContent = t[k];
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === lang);
    });
    state.cards.forEach(function (c) {
      var name = lang === 'ru' ? c.row.name_ru : c.row.name_ua;
      var niche = lang === 'ru' ? c.row.niche_ru : c.row.niche_ua;
      c.nameEl.textContent = name;
      c.nicheEl.textContent = cap(niche);
      c.sepEl.hidden = !niche || !name;
      c.item.querySelector('.meta').hidden = !name && !niche;
      if (c.img) c.img.alt = name ? name + (niche ? ' — ' + cap(niche) : '') : (lang === 'ru' ? 'Отзыв участника' : 'Відгук учасника');
      if (c.wrap && c.zoomable) c.wrap.setAttribute('aria-label', t.zoom);
      if (c.play) c.play.setAttribute('aria-label', t.play);
      if (c.snd) c.snd.setAttribute('aria-label', state.muted ? t.soundOn : t.soundOff);
    });
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    var rows = [], row = [], f = '', q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (ch !== '\r') f += ch;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    var head = rows.shift() || [];
    return rows.filter(function (r) { return r.join('').trim() !== ''; }).map(function (r) {
      var o = {};
      head.forEach(function (h, idx) { o[h.trim()] = (r[idx] || '').trim(); });
      return o;
    });
  }

  /* ---------- DOM-хелпери ---------- */
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(vb, pathD, fill, stroke) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', vb); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', pathD);
    if (fill) p.setAttribute('fill', fill);
    if (stroke) { p.setAttribute('fill', 'none'); p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
    s.appendChild(p); return s;
  }
  function sndIcon(parts, cls) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    parts.forEach(function (d) {
      var p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', d);
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); s.appendChild(p);
    });
    return s;
  }

  /* ---------- HLS ---------- */
  var hlsPromise = null;
  function loadHls() {
    if (window.Hls) return Promise.resolve();
    if (hlsPromise) return hlsPromise;
    hlsPromise = new Promise(function (res) {
      var s = document.createElement('script');
      s.src = 'vendor/hls.light.min.js';
      s.onload = function () { res(); };
      s.onerror = function () { res(); };
      document.head.appendChild(s);
    });
    return hlsPromise;
  }

  function attach(card) {
    if (card.attached) return card.attached;
    var v = card.video, url = 'https://' + CDN + '/' + card.row.media + '/playlist.m3u8';
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url;
      card.attached = Promise.resolve();
    } else {
      card.attached = loadHls().then(function () {
        if (window.Hls && window.Hls.isSupported()) {
          var h = new window.Hls({ capLevelToPlayerSize: true, maxBufferLength: 12, backBufferLength: 10 });
          card.hls = h;
          h.loadSource(url);
          h.attachMedia(v);
        } else {
          v.src = url;
        }
      });
    }
    return card.attached;
  }

  /* ---------- Керування відтворенням ---------- */
  function pauseCard(c) {
    if (c && c.video && !c.video.paused) c.video.pause();
  }

  function playCard(c) {
    if (state.current && state.current !== c) pauseCard(state.current);
    state.current = c;
    attach(c).then(function () {
      var v = c.video;
      v.muted = state.touch ? state.muted : false;
      var p = v.play();
      if (p && p.catch) p.catch(function () {
        // Браузер заборонив автозапуск (економія батареї, вбудований браузер): даємо тап-кнопку
        c.reel.classList.add('needs-tap');
        c.reel.classList.remove('is-playing');
      });
    });
  }

  function toggleSound(fromCard) {
    state.muted = !state.muted;
    var t = DICT[state.lang];
    state.cards.forEach(function (c) {
      if (!c.video) return;
      c.snd.classList.toggle('unmuted', !state.muted);
      c.snd.setAttribute('aria-label', state.muted ? t.soundOn : t.soundOff);
      if (c === state.current || !c.video.paused) c.video.muted = state.muted;
    });
    // Жест користувача: якщо відео стояло через блокування, пробуємо ще раз
    if (fromCard && fromCard.video.paused && fromCard.visible) playCard(fromCard);
  }

  function buildVideo(row, card) {
    var reel = el('div', 'reel');
    var v = document.createElement('video');
    v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.setAttribute('preload', 'none');
    v.setAttribute('disablepictureinpicture', '');
    v.setAttribute('disableremoteplayback', '');
    v.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
    v.setAttribute('x-webkit-airplay', 'deny');
    v.muted = true; v.loop = state.touch;
    v.poster = 'https://' + CDN + '/' + row.media + '/thumbnail.jpg';
    reel.appendChild(v);
    reel.appendChild(el('div', 'shade'));

    var play = el('button', 'play'); play.type = 'button';
    play.appendChild(svg('0 0 26 30', 'M25 15L0 29.3V0.7L25 15Z', '#000'));
    reel.appendChild(play);

    var snd = el('button', 'snd'); snd.type = 'button';
    snd.appendChild(sndIcon(['M11 5 6 9H3v6h3l5 4z', 'M22 9l-6 6', 'M16 9l6 6'], 'off'));
    snd.appendChild(sndIcon(['M11 5 6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'], 'on'));
    reel.appendChild(snd);

    reel.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    v.addEventListener('playing', function () { reel.classList.add('is-playing'); reel.classList.remove('needs-tap'); });
    v.addEventListener('pause', function () { reel.classList.remove('is-playing'); });
    v.addEventListener('ended', function () { reel.classList.remove('is-playing'); });

    // ПК: клік по відео/кнопці = грати зі звуком або пауза
    reel.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.snd')) return;
      if (v.paused) { card.reel.classList.remove('needs-tap'); playCard(card); }
      else if (!state.touch) { v.pause(); }
    });
    snd.addEventListener('click', function (e) { e.stopPropagation(); toggleSound(card); });

    card.reel = reel; card.video = v; card.play = play; card.snd = snd;
    return reel;
  }

  function buildShot(row, card) {
    var wrap = el('div', 'shot-wrap');
    var img = el('img', 'shot');
    img.src = 'assets/shots/' + row.media;
    if (row.w && row.h) { img.width = +row.w; img.height = +row.h; }
    img.decoding = 'async';
    img.loading = card.index < 6 ? 'eager' : 'lazy';
    img.alt = '';
    img.draggable = false;
    wrap.appendChild(img);
    if (row.ring) {
      var p = row.ring.split(/\s+/).map(parseFloat);
      if (p.length === 4 && p.every(function (n) { return !isNaN(n); })) {
        var ring = el('div', 'ring');
        ring.style.left = p[0] + '%'; ring.style.top = p[1] + '%';
        ring.style.width = p[2] + '%'; ring.style.height = p[3] + '%';
        wrap.appendChild(ring);
      }
    }
    card.img = img;
    card.wrap = wrap;
    return wrap;
  }

  /* ---------- Збільшення скріна по кліку (лише ПК) ---------- */
  var zoom = null;

  function openZoom(card) {
    if (zoom) return;
    var wrap = card.wrap;
    var r = wrap.getBoundingClientRect();
    var natW = +card.row.w || r.width, natH = +card.row.h || r.height;
    var vw = window.innerWidth, vh = window.innerHeight;
    var tw = Math.min(natW, vw * 0.9, vh * 0.9 * natW / natH);
    var th = tw * natH / natW;
    var left = (vw - tw) / 2, top = (vh - th) / 2;

    var bg = el('div', 'zoom-bg');
    var fly = buildShot(card.row, { index: 0 });
    fly.classList.add('zoom-fly');
    fly.style.left = left + 'px'; fly.style.top = top + 'px'; fly.style.width = tw + 'px';
    fly.style.transformOrigin = '0 0';
    fly.style.transform = 'translate(' + (r.left - left) + 'px,' + (r.top - top) + 'px) scale(' + (r.width / tw) + ')';
    document.body.appendChild(bg);
    document.body.appendChild(fly);
    wrap.style.visibility = 'hidden';
    fly.getBoundingClientRect();                    // фіксуємо стартовий стан
    bg.classList.add('on');
    fly.style.transform = 'none';

    zoom = { card: card, bg: bg, fly: fly, left: left, top: top, tw: tw, y: window.pageYOffset, closing: false };
    bg.addEventListener('click', closeZoom);
    fly.addEventListener('click', closeZoom);
  }

  function closeZoom() {
    var z = zoom;
    if (!z || z.closing) return;
    z.closing = true;
    var r = z.card.wrap.getBoundingClientRect();
    z.bg.classList.remove('on');
    z.fly.style.transform = 'translate(' + (r.left - z.left) + 'px,' + (r.top - z.top) + 'px) scale(' + (r.width / z.tw) + ')';
    setTimeout(function () {
      z.card.wrap.style.visibility = '';
      if (z.fly.parentNode) z.fly.parentNode.removeChild(z.fly);
      if (z.bg.parentNode) z.bg.parentNode.removeChild(z.bg);
      zoom = null;
    }, 420);
  }

  function bindZoom(card) {
    var wrap = card.wrap;
    card.zoomable = true;
    wrap.classList.add('zoomable');
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.addEventListener('click', function () { openZoom(card); });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZoom(card); }
    });
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeZoom(); });
  window.addEventListener('resize', function () { closeZoom(); });
  window.addEventListener('scroll', function () {
    if (zoom && Math.abs(window.pageYOffset - zoom.y) > 40) closeZoom();
  }, { passive: true });

  function buildCard(row) {
    var card = { row: row, index: state.nextIndex++, visible: false, ratio: 0 };
    var item = el('div', 'item');
    item.appendChild(row.type === 'video' ? buildVideo(row, card) : buildShot(row, card));
    if (row.type === 'shot' && !state.touch) bindZoom(card);
    var meta = el('div', 'meta');
    var b = document.createElement('b');
    var sep = el('span', 'sep'); sep.textContent = '|';
    var niche = document.createElement('span');
    meta.appendChild(b); meta.appendChild(sep); meta.appendChild(niche);
    item.appendChild(meta);
    card.nameEl = b; card.nicheEl = niche; card.sepEl = sep; card.item = item;
    return card;
  }

  function render(rows) {
    var wall = document.getElementById('wall');
    rows.forEach(function (row) {
      if (!row.media) return;                         // відео без ID або файл без назви: пропускаємо
      if (row.type !== 'video' && row.type !== 'shot') return;
      var card = buildCard(row);
      wall.appendChild(card.item);
      state.cards.push(card);
      state.rows.push(row);
    });
    applyLang(state.lang);
    observeVideos();
    watchSticky();
    initLoop();
  }

  /* ---------- Автозапуск при скролі (телефон) і пауза поза екраном (ПК) ---------- */
  var videoIO = null;

  function onVideoIO(entries) {
    var videos = state.videos;
    entries.forEach(function (en) {
      var c = en.target._card; if (!c) return;
      c.ratio = en.intersectionRatio; c.visible = en.isIntersecting;
    });
    if (state.touch) {
      var best = null;
      videos.forEach(function (c) { if (c.ratio >= 0.6 && (!best || c.ratio > best.ratio)) best = c; });
      videos.forEach(function (c) { if (c !== best) pauseCard(c); });
      if (best && best.video.paused && !best.reel.classList.contains('needs-tap')) playCard(best);
    } else {
      videos.forEach(function (c) { if (c.ratio < 0.15) pauseCard(c); });
    }
  }

  function watchVideo(c) {
    if (!c.video || !videoIO) return;
    c.reel._card = c; state.videos.push(c); videoIO.observe(c.reel);
  }

  function unwatchVideo(c) {
    if (!c.video) return;
    if (videoIO) videoIO.unobserve(c.reel);
    var i = state.videos.indexOf(c); if (i > -1) state.videos.splice(i, 1);
    pauseCard(c);
    if (c.hls) { try { c.hls.destroy(); } catch (e) { /* ігноруємо */ } c.hls = null; }
    if (state.current === c) state.current = null;
  }

  function observeVideos() {
    if (!('IntersectionObserver' in window)) return;
    videoIO = new IntersectionObserver(onVideoIO, { threshold: [0, 0.15, 0.3, 0.5, 0.6, 0.75, 0.9, 1] });
    state.cards.forEach(watchVideo);
  }

  /* ---------- Нескінченна стрічка на телефоні ----------
     Коли користувач наближається до низу, дописуємо ще одну «порцію» відгуків, починаючи
     з ДРУГОГО (перший під заголовком не повторюється, перший екран більше не з'являється).
     Нічого не телепортуємо і не скролимо кодом, тому швидкий інерційний скрол не переривається. */
  function initLoop() {
    // на передзаписі стрічка показується один раз і закінчується
    if (isPrereg()) return;
    if (!window.matchMedia || state.rows.length < 2) return;
    var mq = window.matchMedia('(max-width: 520px)');
    var wall = document.getElementById('wall');
    var KEEP = 2;                 // скільки останніх порцій тримаємо в DOM повністю
    var lastAdd = 0, ticking = false;

    function prune() {
      var live = state.batches.filter(function (b) { return !b.pruned; });
      while (live.length > KEEP) {
        var b = live.shift();
        var h = b.el.getBoundingClientRect().height;
        b.cards.forEach(function (c) {
          unwatchVideo(c);
          var i = state.cards.indexOf(c); if (i > -1) state.cards.splice(i, 1);
        });
        while (b.el.firstChild) b.el.removeChild(b.el.firstChild);
        b.el.style.height = h + 'px';
        b.pruned = true;
      }
    }

    function addBatch() {
      var box = el('div', 'batch');
      var cards = [];
      state.rows.slice(1).forEach(function (row) {
        var c = buildCard(row);
        box.appendChild(c.item);
        cards.push(c);
      });
      wall.appendChild(box);
      cards.forEach(function (c) { state.cards.push(c); watchVideo(c); });
      state.batches.push({ el: box, cards: cards, pruned: false });
      applyLang(state.lang);
      prune();
    }

    function check() {
      ticking = false;
      if (!mq.matches) return;
      var vh = window.innerHeight || 800;
      var left = document.documentElement.scrollHeight - (window.pageYOffset + vh);
      var now = Date.now();
      if (left < vh * 3 && now - lastAdd > 250) {
        lastAdd = now;
        addBatch();
        schedule();                       // сторінка могла бути короткою: перевіряємо ще раз
      }
    }
    function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(check); } }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
  }

  /* ---------- Закріплена кнопка після N-го відгука ---------- */
  function watchSticky() {
    var bar = document.getElementById('cta');
    var link = document.getElementById('cta-link');
    // на передзаписі кнопка веде до анкети на цій же сторінці, зовнішній url не підставляємо
    if (!isPrereg()) link.href = C.ctaUrl || link.href;
    var n = Math.max(1, C.stickyAfter || 5);
    var ticking = false;
    function check() {
      ticking = false;
      var c = state.cards[Math.min(n, state.cards.length) - 1];
      if (!c) return;
      var r = c.item.getBoundingClientRect();
      var show = r.top < (window.innerHeight || 800) * 0.5;
      bar.classList.toggle('on', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
      link.tabIndex = show ? 0 : -1;
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(check); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    check();
  }

  /* ---------- Досягнення: на телефоні нескінченна карусель ---------- */
  function initStats() {
    var box = document.getElementById('stats');
    if (!box) return;
    var track = box.querySelector('.stats-track');
    var items = Array.prototype.slice.call(track.children);
    for (var k = 0; k < 2; k++) {
      items.forEach(function (it) {
        var c = it.cloneNode(true);
        c.classList.add('clone'); c.setAttribute('aria-hidden', 'true');
        track.appendChild(c);
      });
    }
    var mq = window.matchMedia('(max-width: 600px)');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SPEED = 34;                                   // px за секунду, справа наліво
    var x = 0, vel = 0, drag = false, lastX = 0, lastT = 0, resumeAt = 0, raf = 0, visible = true, last = 0;

    function setW() { return track.children[items.length].offsetLeft - track.children[0].offsetLeft; }
    function apply() {
      var w = setW();
      if (w > 0) x = ((x % w) + w) % w;               // кільце: докрутити до кінця неможливо
      track.style.transform = 'translate3d(' + (-x) + 'px,0,0)';
    }
    function frame(t) {
      raf = 0;
      if (!mq.matches || !visible) return;
      var dt = Math.min(64, t - last) / 1000; last = t;
      if (!drag) {
        if (Math.abs(vel) > 8) { x += vel * dt; vel *= Math.pow(0.02, dt); resumeAt = t + 1200; }
        else if (!reduce && t >= resumeAt) { x += SPEED * dt; }
      }
      apply();
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (raf || !mq.matches || !visible) return;
      last = performance.now(); raf = requestAnimationFrame(frame);
    }
    function onMq() {
      if (mq.matches) start();
      else { x = 0; vel = 0; track.style.transform = ''; }
    }
    box.addEventListener('pointerdown', function (e) {
      if (!mq.matches) return;
      drag = true; lastX = e.clientX; lastT = performance.now(); vel = 0;
    });
    box.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var now = performance.now(), dx = e.clientX - lastX;
      x -= dx; vel = 0.7 * vel + 0.3 * (-dx / Math.max(1, now - lastT) * 1000);
      lastX = e.clientX; lastT = now; apply();
    });
    function end() { if (!drag) return; drag = false; resumeAt = performance.now() + 1500; }
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(box);
    }
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    window.addEventListener('resize', function () { if (mq.matches) apply(); });
    onMq();
  }

  /* ---------- Старт ---------- */
  function init() {
    initStats();
    state.touch = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    if (state.touch) document.documentElement.classList.add('touch');
    state.lang = pickLang();
    applyLang(state.lang);

    // На передзаписі кнопка відкриває попап-анкету замість переходу на основний ленд
    if (isPrereg()) {
      document.documentElement.classList.add('rtg');
      var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'rtg.css'; document.head.appendChild(lk);
      var sc = document.createElement('script'); sc.src = 'rtg.js'; sc.async = true; document.head.appendChild(sc);
    }

    // на передзаписі перемикач — звичайні посилання на сусідню адресу, вішати нічого не треба
    if (!isPrereg()) Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (b) {
      b.addEventListener('click', function () {
        var l = b.getAttribute('data-lang');
        try { localStorage.setItem('vl_lang', l); } catch (e) {}
        applyLang(l);
      });
    });

    fetch('data/reviews.csv', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('csv ' + r.status); return r.text(); })
      .then(function (t) { render(parseCSV(t)); })
      .catch(function () { /* без даних сторінка лишається з першим екраном */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
