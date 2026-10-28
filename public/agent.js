/* Сторінка /pre-reg-form-agent. Тексти тут статичні (ленд поки тільки російською),
   тому словника немає — лишається дата дедлайну, відео в мокапі і прокрутка до анкети.
   Те саме, що prereg.js робить для /pre-reg-form, тільки без перемикання мови. */
(function () {
  'use strict';

  /* Дедлайн — завтра за Варшавою. Дата рахується на клієнті;
     щоб зафіксувати її на хвилю трафіку, тут ставиться константа замість Date.now(). */
  function deadline() {
    var el = document.getElementById('deadline');
    if (!el) return;
    try {
      var d = new Date(Date.now() + 86400000);
      el.textContent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' }).format(d);
    } catch (e) {
      el.textContent = 'завтра';
    }
  }

  /* Заголовок не повинен розсипатись на екранах вужчих за макет: зменшуємо кегль,
     поки він не вкладеться у чотири рядки. */
  function fitH1() {
    var h = document.querySelector('.hero-main h1');
    if (!h) return;
    for (var px = 30; px >= 18; px--) {
      h.style.fontSize = px + 'px';
      var lh = parseFloat(getComputedStyle(h).lineHeight) || px * 1.12;
      if (h.offsetHeight / lh < 4.5) return;
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
