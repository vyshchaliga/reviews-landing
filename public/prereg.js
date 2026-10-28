/* Сторінка /pre-reg-form: тексти офера двома мовами, дата дедлайну і відео в мокапі.
   Підключається після app.js, бо слухає його подію зміни мови. */
(function () {
  'use strict';

  var P = {
    ru: {
      pageTitle: 'Анкета предзаписи — Высшая Лига 6.0',
      brand: 'Высшая Лига 6.0',
      qual: 'Премиальная программа по масштабированию инфобизнесов',
      h1a: 'Сделай свой следующий запуск в 2027 — ', h1b: 'рекордным',
      h1c: ' и подготовься к новым реалиям рынка',
      offerCta: 'Узнать детали программы',
      bonusA: 'Заполни анкету до',
      bonusB: 'и гарантированно забери бонус',
      bonusN: '«Разбор моего запуска на $300К»',
      wallA: 'Результаты участников', wallB: 'Высшая Лига',
      cta: 'Оставить анкету'
    },
    ua: {
      pageTitle: 'Анкета передзапису — Вища Ліга 6.0',
      brand: 'Вища Ліга 6.0',
      qual: 'Преміальна програма з масштабування інфобізнесів',
      h1a: 'Зроби свій наступний запуск у 2027 — ', h1b: 'рекордним',
      h1c: ' і підготуйся до нових реалій ринку',
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
    setTimeout(function () { document.title = t.pageTitle; }, 0);
    deadline();
    fitH1();
  }

  /* Заголовок не довший за три рядки. Текст різний у двох мовах і ширина екрана
     теж різна, тому кегль підбираємо вимірюванням, а не зашиваємо в CSS. */
  function fitH1() {
    var h = document.querySelector('.prereg h1');
    if (!h) return;
    for (var px = 26; px >= 16; px--) {
      h.style.fontSize = px + 'px';
      var lh = parseFloat(getComputedStyle(h).lineHeight) || px * 1.2;
      if (h.offsetHeight / lh < 3.5) return;              // 3 рядки з запасом на округлення
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
