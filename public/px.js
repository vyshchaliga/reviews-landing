/* Meta Pixel. Окремий файл, а не вбудований скрипт: CSP забороняє inline,
   зате script-src 'self' пускає цей файл, а fbevents.js дозволений окремо в vercel.json.
   PageView шлеться звідси при завантаженні, подію Lead шле rtg.js після прийнятої анкети. */
(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
  if (!f._fbq) f._fbq = n;
  n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
  t = b.createElement(e); t.async = !0; t.src = v;
  s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
}(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js'));

fbq('init', '1716061316756450');
fbq('track', 'PageView');
