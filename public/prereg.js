/* Сторінка /pre-reg-form: тексти офера двома мовами, дата дедлайну і відео в мокапі.
   Підключається після app.js, бо слухає його подію зміни мови. */
(function () {
  'use strict';

  var P = {
    ru: {
      pageTitle: 'Анкета предзаписи — Высшая Лига 6.0',
      pageDesc: 'Анкета предзаписи на шестой поток программы «Высшая Лига».',
      brand: 'Высшая Лига 6.0',
      qual: 'Премиальная программа\nпо масштабированию инфобизнесов',
      h1a: 'Сделай свой запуск в 2027 – ', h1b: 'рекордным', h1b2: 'и подготовься',
      h1c: ' к новым реалиям рынка',
      offerCta: 'Узнать детали программы',
      bonusA: 'Заполни анкету до',
      bonusB: 'и гарантированно забери бонус',
      bonusN: '«Разбор моего запуска на $300К»',
      wallA: 'Результаты участников', wallB: 'Высшая Лига',
      cta: 'Оставить анкету'
    },
    ua: {
      pageTitle: 'Анкета передзапису — Вища Ліга 6.0',
      pageDesc: 'Анкета передзапису на шостий потік програми «Вища Ліга».',
      brand: 'Вища Ліга 6.0',
      qual: 'Преміальна програма\nз масштабування інфобізнесів',
      h1a: 'Зроби свій запуск у 2027 – ', h1b: 'рекордним', h1b2: 'і підготуйся',
      h1c: ' до нових реалій ринку',
      offerCta: 'Дізнатися деталі програми',
      bonusA: 'Заповни анкету до',
      bonusB: 'та гарантовано отримай бонус',
      bonusN: '«Розбір мого запуску на $300К»',
      wallA: 'Результати учасників', wallB: 'Вища Ліга',
      cta: 'Залишити анкету'
    }
  };

  function lang() { return document.documentElement.lang === 'ru' ? 'ru' : 'ua'; }

  function apply() {
    var t = P[lang()];
    document.querySelectorAll('[data-p18n]').forEach(function (n) {
      var k = n.getAttribute('data-p18n');
      if (!t[k]) return;
      // \n у рядку = жорсткий перенос: кваліфікатор завжди у два рядки
      if (t[k].indexOf('\n') < 0) { n.textContent = t[k]; return; }
      n.textContent = '';
      t[k].split('\n').forEach(function (part, i) {
        if (i) n.appendChild(document.createElement('br'));
        n.appendChild(document.createTextNode(part));
      });
    });
    // app.js ставить свій заголовок синхронно одразу після події vl:lang,
    // тож свій ставимо наступним тіком, інакше його перетирає
    setTimeout(function () {
      document.title = t.pageTitle;
      var md = document.querySelector('meta[name="description"]');
      if (md) md.setAttribute('content', t.pageDesc);
    }, 0);
    deadline();
    fitH1();
  }

  /* Заголовок має лишатись у двох рядках: жорсткий перенос стоїть у тексті, а тут
     зменшуємо кегль, поки жоден з рядків не почне переноситись сам. Міряємо, а не
     зашиваємо в CSS, бо тексти двома мовами і ширини екранів різні. */
  function fitH1() {
    var h = document.querySelector('.prereg h1');
    if (!h) return;
    // data-fit="off" — кегль заголовка цілком віддано CSS (так живе світлий ленд /pre-reg-form-d)
    if (h.getAttribute('data-fit') === 'off') { h.style.fontSize = ''; return; }
    for (var px = 24; px >= 14; px--) {
      h.style.fontSize = px + 'px';
      var lh = parseFloat(getComputedStyle(h).lineHeight) || px * 1.16;
      if (h.offsetHeight / lh < 2.5) return;           // два рядки з запасом на округлення
    }
  }

  /* Обидві кнопки — під бонусом і закріплена внизу — прокручують до анкети.
     Попапа з анкетою більше немає, картка завжди стоїть у слоті на сторінці. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#prereg-slot"]');
    if (!a) return;
    var box = document.getElementById('prereg-slot');
    if (!box) return;
    e.preventDefault();
    var soft = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    try { box.scrollIntoView({ behavior: soft ? 'smooth' : 'auto', block: 'start' }); }
    catch (err) { box.scrollIntoView(); }
  });

  /* Дедлайн — завтра за Варшавою. Дата рахується на клієнті;
     щоб зафіксувати її на хвилю трафіку, тут ставиться константа замість Date.now(). */
  function deadline() {
    var el = document.getElementById('deadline');
    if (!el) return;
    try {
      var d = new Date(Date.now() + 86400000);
      var loc = lang() === 'ru' ? 'ru-RU' : 'uk-UA';
      el.textContent = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' }).format(d);
    } catch (e) {
      el.textContent = lang() === 'ru' ? 'завтра' : 'завтра';
    }
  }

  /* Відео в мокапі: вантажимо й крутимо тільки коли воно у вьюпорті.
     Без звуку, без контролів; при prefers-reduced-motion лишається постер. */
  var obs = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (v.getAttribute('preload') !== 'auto') { v.setAttribute('preload', 'auto'); v.load(); }
        var p = v.play();
        if (p && p.catch) p.catch(function () { /* автозапуск заблокований — лишається постер */ });
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { threshold: 0.25 }) : null;

  function startVideos() {
    if (!obs) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.lap-v').forEach(function (v) { obs.observe(v); });
  }

  apply();
  startVideos();
  document.addEventListener('vl:lang', apply);
  window.addEventListener('resize', fitH1);
  // шрифт може приїхати пізніше за перший замір — тоді переміряємо
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitH1);
})();
