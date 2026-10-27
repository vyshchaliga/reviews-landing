/* Сторінка /pre-reg-form: тексти офера двома мовами, дата дедлайну і відео в мокапі.
   Підключається після app.js, бо слухає його подію зміни мови. */
(function () {
  'use strict';

  var P = {
    ru: {
      pageTitle: 'Анкета предзаписи — Высшая Лига 6.0',
      qual: 'Премиальная программа по развитию\nи масштабированию инфобизнесов',
      h1a: 'Анкета предзаписи', h1b: 'Высшая Лига 6.0',
      lede: 'Подготовь свой инфобизнес к рынку 2027 и сделай следующий запуск рекордным',
      bonusA: 'Зарегистрируйся до',
      bonusB: 'и гарантированно забери бонус',
      bonusN: '«Разбор запуска на $300К»',
      wallA: 'Результаты участников', wallB: 'Высшая Лига',
      cta: 'Оставить анкету'
    },
    ua: {
      pageTitle: 'Анкета передзапису — Вища Ліга 6.0',
      qual: 'Преміальна програма з розвитку\nта масштабування інфобізнесів',
      h1a: 'Анкета передзапису', h1b: 'Вища Ліга 6.0',
      lede: 'Підготуй свій інфобізнес під ринок 2027 та зроби наступний запуск рекордним',
      bonusA: 'Зареєструйся до',
      bonusB: 'та гарантовано отримай бонус',
      bonusN: '«Розбір запуску на $300К»',
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
  }

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
})();
