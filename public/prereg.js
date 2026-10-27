/* Сторінка /pre-reg-form: тексти офера двома мовами, дата дедлайну і відео в мокапах.
   Підключається після app.js, бо слухає його подію зміни мови. */
(function () {
  'use strict';

  var P = {
    ua: {
      pageTitle: 'Анкета передзапису — Вища Ліга 6.0',
      qual: 'Преміальна програма з розвитку і масштабування інфо- та онлайн-бізнесів',
      h1a: 'Анкета передзапису', h1b: 'Вища Ліга 6.0',
      lede: 'Підготуй свій інфобізнес під ринок 2027 та зроби наступний запуск рекордним',
      s1c: 'заробили учасники на своїх запусках',
      s2c: 'перевіреної методології',
      s3c: 'сильних продюсерів та експертів',
      s4c: 'де працюють наші інструменти',
      trigA: 'Заповни анкету до',
      bonusK: 'Бонус за анкету', bonusT: 'Безоплатний розбір твого інфобіз-проєкту',
      wallA: 'Результати учасників', wallB: 'Вища Ліга',
      cta: 'Залишити анкету'
    },
    ru: {
      pageTitle: 'Анкета предзаписи — Высшая Лига 6.0',
      qual: 'Премиальная программа по развитию и масштабированию инфо- и онлайн-бизнесов',
      h1a: 'Анкета предзаписи', h1b: 'Высшая Лига 6.0',
      lede: 'Подготовь свой инфобизнес к рынку 2027 и сделай следующий запуск рекордным',
      s1c: 'заработали участники на своих запусках',
      s2c: 'проверенной методологии',
      s3c: 'сильных продюсеров и экспертов',
      s4c: 'где работают наши инструменты',
      trigA: 'Заполни анкету до',
      bonusK: 'Бонус за анкету', bonusT: 'Бесплатный разбор твоего инфобиз-проекта',
      wallA: 'Результаты участников', wallB: 'Высшая Лига',
      cta: 'Оставить анкету'
    }
  };

  function lang() { return document.documentElement.lang === 'ru' ? 'ru' : 'ua'; }

  function apply() {
    var t = P[lang()];
    document.querySelectorAll('[data-p18n]').forEach(function (n) {
      var k = n.getAttribute('data-p18n');
      if (t[k]) n.textContent = t[k];
    });
    // app.js ставить свій заголовок синхронно одразу після події vl:lang,
    // тож свій ставимо наступним тіком, інакше його перетирає
    setTimeout(function () { document.title = t.pageTitle; }, 0);
    deadline();
  }

  /* Дедлайн — завтра 23:59 за Варшавою. Дата рахується на клієнті;
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

  /* Відео в мокапах: вантажимо й крутимо тільки те, що у вьюпорті.
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
