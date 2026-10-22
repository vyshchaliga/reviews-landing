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
      h1a: 'Що говорять', h1b: 'учасники', h1bg: 'про', h1c: 'Вищу Лігу',
      cta: 'Хочу у Вищу Лігу',
      play: 'Відтворити', pause: 'Пауза', soundOn: 'Увімкнути звук', soundOff: 'Вимкнути звук'
    },
    ru: {
      title: 'Что говорят участники о Высшей Лиге',
      h1a: 'Что говорят', h1b: 'участники', h1bg: 'о', h1c: 'Высшей Лиге',
      cta: 'Хочу в Высшую Лигу',
      play: 'Воспроизвести', pause: 'Пауза', soundOn: 'Включить звук', soundOff: 'Выключить звук'
    }
  };

  var state = {
    lang: 'ua',
    muted: true,       // глобальний стан звуку (для телефона)
    touch: false,
    cards: [],         // { row, reel, video, nameEl, nicheEl, ... }
    current: null      // картка, що зараз грає
  };

  /* ---------- Мова ---------- */
  function pickLang() {
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
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uk';
    document.title = t.title;
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
      c.sepEl.hidden = !niche;
      if (c.img) c.img.alt = name + ' — ' + cap(niche);
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
    return wrap;
  }

  function render(rows) {
    var wall = document.getElementById('wall');
    rows.forEach(function (row, i) {
      if (!row.media) return;                         // відео без ID або файл без назви: пропускаємо
      if (row.type !== 'video' && row.type !== 'shot') return;
      var card = { row: row, index: state.cards.length, visible: false, ratio: 0 };
      var item = el('div', 'item');
      item.appendChild(row.type === 'video' ? buildVideo(row, card) : buildShot(row, card));
      var meta = el('div', 'meta');
      var b = document.createElement('b');
      var sep = el('span', 'sep'); sep.textContent = '|';
      var niche = document.createElement('span');
      meta.appendChild(b); meta.appendChild(sep); meta.appendChild(niche);
      item.appendChild(meta);
      card.nameEl = b; card.nicheEl = niche; card.sepEl = sep; card.item = item;
      wall.appendChild(item);
      state.cards.push(card);
    });
    applyLang(state.lang);
    observeVideos();
    watchSticky();
  }

  /* ---------- Автозапуск при скролі (телефон) і пауза поза екраном (ПК) ---------- */
  function observeVideos() {
    var videos = state.cards.filter(function (c) { return c.video; });
    if (!videos.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var c = en.target._card; c.ratio = en.intersectionRatio; c.visible = en.isIntersecting;
      });
      if (state.touch) {
        var best = null;
        videos.forEach(function (c) { if (c.ratio >= 0.6 && (!best || c.ratio > best.ratio)) best = c; });
        videos.forEach(function (c) { if (c !== best) pauseCard(c); });
        if (best && best.video.paused && !best.reel.classList.contains('needs-tap')) playCard(best);
        else if (best && best.reel.classList.contains('needs-tap')) { /* чекаємо тапу */ }
      } else {
        videos.forEach(function (c) { if (c.ratio < 0.15) pauseCard(c); });
      }
    }, { threshold: [0, 0.15, 0.3, 0.5, 0.6, 0.75, 0.9, 1] });
    videos.forEach(function (c) { c.reel._card = c; io.observe(c.reel); });
  }

  /* ---------- Закріплена кнопка після N-го відгука ---------- */
  function watchSticky() {
    var bar = document.getElementById('cta');
    var link = document.getElementById('cta-link');
    link.href = C.ctaUrl || link.href;
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

  /* ---------- Старт ---------- */
  function init() {
    state.touch = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    if (state.touch) document.documentElement.classList.add('touch');
    state.lang = pickLang();
    applyLang(state.lang);

    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (b) {
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
