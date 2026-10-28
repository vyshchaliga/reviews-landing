/* Сторінка /pre-reg-form-consult. Тексти тут статичні (ленд поки тільки російською),
   тому словника немає — лишається дата дедлайну, відео в мокапі і прокрутка до анкети.
   Те саме, що agent.js робить для /pre-reg-form-agent; підгонки кегля заголовка немає,
   бо тут він довгий і верстається в кілька рядків сам. */
(function () {
  'use strict';

  /* Дедлайн — завтра за Варшавою. Дата стоїть у двох місцях: у картці бонуса
     і на екрані телефона в кадрі, тому заповнюємо всі [data-deadline] одразу. */
  function deadline() {
    var txt = 'завтра';
    try {
      var d = new Date(Date.now() + 86400000);
      txt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' }).format(d);
    } catch (e) { /* лишається «завтра» */ }
    Array.prototype.forEach.call(document.querySelectorAll('[data-deadline]'), function (el) {
      el.textContent = txt;
    });
  }

  /* Заголовок тримається у трьох рядках: переноси стоять у розмітці, а тут
     зменшуємо кегль, поки жоден з рядків не почне переноситись сам. */
  function fitH1() {
    var h = document.querySelector('.hero-main h1');
    if (!h) return;
    for (var px = 26; px >= 14; px--) {
      h.style.fontSize = px + 'px';
      var lh = parseFloat(getComputedStyle(h).lineHeight) || px * 1.24;
      if (h.offsetHeight / lh < 3.4) return;
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
