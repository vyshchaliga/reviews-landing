/**
 * Сповіщення про нові анкети в Telegram.
 *
 * Куди ставити: таблиця «Анкети з Tilda - ВЛ 60», Розширення → Apps Script,
 * окремий файл у тому ж проєкті. Можна і окремим проєктом на script.google.com —
 * таблиця береться за id, прив'язка до неї не обов'язкова. Розгортати (Deploy)
 * нічого не треба: це не веб-застосунок, він працює за розкладом.
 *
 * Чому не onEdit/onChange: рядки в цю таблицю пише не людина, а Тільда (через
 * Google Sheets API) і наш веб-застосунок (через інший скрипт). Google НЕ запускає
 * тригери правок на таких записах — сповіщення просто не приходили б. Тому тут
 * щохвилинний тригер: скрипт пам'ятає, доки він уже дочитав, і шле все, що з'явилось.
 *
 * Налаштування — у Властивостях скрипта (Project Settings → Script Properties):
 *   TG_TOKEN — токен бота від @BotFather
 *   TG_CHAT  — куди слати: id чату, групи або каналу (див. showChatId нижче)
 * Токен у властивостях, а не в коді: код видно всім, у кого є доступ до таблиці.
 */
// Таблиця вказана за id, а не через getActiveSpreadsheet(): так скрипт працює
// і прив'язаним до таблиці, і окремим проєктом.
var SHEET_ID = '1n4dPYxS-Gz7OjA2suN24ugGKu_f_o6cxu5STYCe_rrg';   // «Анкети з Tilda - ВЛ 60»
var NOTIFY_SHEET = 'Лист1';          // вкладка, куди падають анкети
var CURSOR_KEY = 'tg_last_row';      // останній рядок, про який уже відзвітували

function book_() { return SpreadsheetApp.openById(SHEET_ID); }

function notifyNewLeads() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;   // попередній запуск ще не добіг — пропускаємо
  try {
    var sh = book_().getSheetByName(NOTIFY_SHEET);
    if (!sh) return;

    var props = PropertiesService.getScriptProperties();
    var last = sh.getLastRow();
    var seen = parseInt(props.getProperty(CURSOR_KEY), 10);

    // Перший запуск: нічого не шлемо заднім числом, лише запам'ятовуємо, де стоїмо.
    if (!seen) { props.setProperty(CURSOR_KEY, String(last)); return; }
    // Рядки могли видалити — тоді просто пересуваємо позначку назад.
    if (last <= seen) { props.setProperty(CURSOR_KEY, String(last)); return; }

    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    var rows = sh.getRange(seen + 1, 1, last - seen, sh.getLastColumn()).getDisplayValues();

    for (var i = 0; i < rows.length; i++) {
      send_(format_(head, rows[i]));
      // Зсуваємо позначку після кожного рядка: якщо наступний впаде,
      // при наступному запуску не продублюється вже надісланий.
      props.setProperty(CURSOR_KEY, String(seen + 1 + i));
    }
  } finally {
    lock.releaseLock();
  }
}

/* Один рядок таблиці → текст повідомлення. Беремо всі колонки, що не порожні,
   у тому ж порядку, що й у таблиці. Порожні пропускаємо, щоб не було стіни прочерків. */
function format_(head, row) {
  var out = ['🔥 Нова анкета'];
  for (var i = 0; i < head.length; i++) {
    var k = String(head[i]).trim();
    var v = String(row[i] == null ? '' : row[i]).trim();
    if (!k || !v) continue;
    out.push(k + ': ' + v);
  }
  var t = out.join('\n');
  // Ліміт Telegram — 4096 символів, а referer з fbclid буває дуже довгий.
  return t.length > 3900 ? t.slice(0, 3900) + '…' : t;
}

function send_(text) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TG_TOKEN');
  var chat = props.getProperty('TG_CHAT');
  if (!token || !chat) throw new Error('Немає TG_TOKEN або TG_CHAT у властивостях скрипта');

  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    payload: { chat_id: chat, text: text, disable_web_page_preview: 'true' },
    muteHttpExceptions: true
  });
  var j = JSON.parse(r.getContentText() || '{}');
  if (!j.ok) throw new Error('Telegram: ' + r.getContentText());
}

/* ===== Разові помічники (запускати вручну з редактора) ===== */

/* Дізнатися id чату. Перед запуском дати боту привід «побачити» потрібне місце:
   в особистих — написати йому будь-що; у групі — написати «/start@ім'я_бота»
   (просте повідомлення бот не бачить, у нього ввімкнено режим приватності);
   у каналі — зробити бота адміністратором і запостити будь-що.
   Потім запустити цю функцію і подивитись у Виконання → Журнал.
   Id групи й каналу — завжди від'ємне число, це нормально. */
function showChatId() {
  var token = PropertiesService.getScriptProperties().getProperty('TG_TOKEN');
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates', { muteHttpExceptions: true });
  var j = JSON.parse(r.getContentText() || '{}');
  var list = j.result || [];
  if (!list.length) { Logger.log('Порожньо. Дай боту привід побачити чат (див. коментар вище) і запусти ще раз.'); return; }
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var u = list[i];
    // Тип оновлення може бути різний: повідомлення, пост у каналі, додавання бота
    // в групу. Чат лежить у кожному з них, тому просто шукаємо .chat де завгодно.
    for (var k in u) {
      var chat = u[k] && u[k].chat;
      if (!chat || seen[chat.id]) continue;
      seen[chat.id] = true;
      Logger.log('chat_id: ' + chat.id + '   ' + (chat.title || chat.username || '') + '   [' + chat.type + ']');
    }
  }
}

/* Перевірка: шле в Telegram останній рядок таблиці, нічого не змінюючи. */
function testLastRow() {
  var sh = book_().getSheetByName(NOTIFY_SHEET);
  var last = sh.getLastRow();
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  var row = sh.getRange(last, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  send_(format_(head, row));
}

/* Ставить щохвилинний тригер (старий такий самий прибирає, щоб не задвоївся). */
function installTrigger() {
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'notifyNewLeads') ScriptApp.deleteTrigger(all[i]);
  }
  ScriptApp.newTrigger('notifyNewLeads').timeBased().everyMinutes(1).create();
  Logger.log('Тригер поставлено: notifyNewLeads щохвилини');
}
