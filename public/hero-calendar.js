/* /pre-reg-form-consult: календар на першому екрані відпрацьовує один раз.
   1) вікна по одному займаються клієнтами, лічильник «Свободных окон» 25 → 0;
   2) жовта галочка «Своя программа»;
   3) нижній ряд темних вікон гасне, на його місці — «Свободное время». */
(function () {
  'use strict';
  var cal = document.querySelector('.hcal');
  if (!cal) return;
  var grid = Array.prototype.slice.call(cal.querySelectorAll('.hcal-g i'));      // у порядку сітки: 5 днів × 5 рядків
  var slots = grid.slice().sort(function (a, b) { return (+a.style.getPropertyValue('--i')) - (+b.style.getPropertyValue('--i')); });
  var n = document.getElementById('hcal-n');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP = reduce ? 0 : 110, START = reduce ? 0 : 500;
  function t(fn, ms) { setTimeout(fn, reduce ? 0 : ms); }
  var FREE_ROW = [20, 21, 22, 23, 24];   // нижній ряд сітки (5 днів) звільняється
  var left = slots.length;
  if (n) n.textContent = left;
  slots.forEach(function (s, i) {
    t(function () {
      s.classList.add('on');
      left -= 1;
      if (n) n.textContent = left;
      if (left === 0) {
        t(function () { cal.classList.add('done'); }, 350);
        t(function () {
          FREE_ROW.forEach(function (p) { if (grid[p]) grid[p].classList.add('free'); });
          cal.classList.add('life');
        }, 1400);
      }
    }, START + i * STEP);
  });
})();
