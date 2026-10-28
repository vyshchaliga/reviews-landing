/* Сторінки /pre-reg-form-agent і /pre-reg-form-agent/ua. Тексти в розмітці статичні —
   українську сторінку збирає scripts/build-agent-ua-page.mjs, — тому словника тут немає.
   Лишається дата дедлайну, відео в мокапі і прокрутка до анкети. */
(function () {
  'use strict';

  /* Дедлайн — завтра за Варшавою. Дата рахується на клієнті;
     щоб зафіксувати її на хвилю трафіку, тут ставиться константа замість Date.now(). */
  function deadline() {
    var el = document.getElementById('deadline');
    if (!el) return;
    var ua = document.documentElement.lang !== 'ru';
    try {
      var d = new Date(Date.now() + 86400000);
      el.textContent = new Intl.DateTimeFormat(ua ? 'uk-UA' : 'ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' }).format(d);
    } catch (e) {
      el.textContent = 'завтра';   // однаково обома мовами
    }
  }

  /* Заголовок тримається у двох рядках: перенос стоїть у розмітці, а тут
     зменшуємо кегль, поки жоден з рядків не почне переноситись сам. */
  function fitH1() {
    var h = document.querySelector('.hero-main h1');
    if (!h) return;
    for (var px = 32; px >= 16; px--) {
      h.style.fontSize = px + 'px';
      var lh = parseFloat(getComputedStyle(h).lineHeight) || px * 1.38;
      if (h.offsetHeight / lh < 2.5) return;
    }
  }

  /* Відео в мокапі: вантажимо й крутимо тільки коли воно у вьюпорті. */
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

  /* Обидві кнопки — під бонусом і закріплена внизу — прокручують до анкети. */
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

  deadline();
  fitH1();
  startVideos();
  window.addEventListener('resize', fitH1);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitH1);
})();
