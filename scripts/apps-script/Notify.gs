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

// CRM: сюди кожна нова анкета лягає окремим рядком.
var CRM_ID = '1SbsCUs4BURdoKK98SR8LhdfdXhAcx3OjTO4iZXl5hb8';     // «ТИМЧАСОВА - CRM ВЛ 6.0»
var CRM_SHEET = 'Лиды ВЛ 6.0';
var CRM_CURSOR = 'crm_last_row';     // лічильник окремий від телеграмного, щоб одне не ламало інше
var CRM_STATUS = 'Новый';            // статус, з яким заявка заходить у воронку

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
  var jobs = ['notifyNewLeads', 'crmSync'];
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (jobs.indexOf(all[i].getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(all[i]);
  }
  for (var j = 0; j < jobs.length; j++) ScriptApp.newTrigger(jobs[j]).timeBased().everyMinutes(1).create();
  Logger.log('Тригери поставлено щохвилини: ' + jobs.join(', '));
}

/* Разово дослати в канал заявки, які вже є в таблиці (ті, що впали до того,
   як запрацював тригер). Шле всі рядки, у яких sent не раніший за FROM_DATE.
   Позначку «докуди дочитано» не чіпає, тому на автоматику не впливає —
   але якщо тригер уже працює, свіжі заявки можуть продублюватись. */
function sendSince() {
  var FROM_DATE = '2026-10-31';   // формат yyyy-MM-dd, можна і з часом: '2026-10-31 09:00:00'

  var sh = book_().getSheetByName(NOTIFY_SHEET);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getDisplayValues();
  var col = head.indexOf('sent');
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    // Дата лежить як текст yyyy-MM-dd HH:mm:ss, тому звичайне порівняння рядків працює.
    if (String(rows[i][col]).trim() < FROM_DATE) continue;
    send_(format_(head, rows[i]));
    n++;
  }
  Logger.log('Надіслано заявок: ' + n);
}

/* ===== Вигрузка в CRM ===== */

/* Кожна нова анкета лягає рядком у вкладку «Лиды ВЛ 6.0».
   Заповнюємо тільки те, що анкета справді знає: дату, ім'я, телеграм, джерело
   і статус. Менеджера, тариф, суми й коментар ставлять руками — ці колонки
   лишаємо порожніми, щоб нічого не затерти.
   Лічильник окремий від телеграмного: якщо одне впаде, друге працює далі. */
function crmSync() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var sh = book_().getSheetByName(NOTIFY_SHEET);
    var crm = SpreadsheetApp.openById(CRM_ID).getSheetByName(CRM_SHEET);
    if (!sh || !crm) return;

    var props = PropertiesService.getScriptProperties();
    var last = sh.getLastRow();
    var seen = parseInt(props.getProperty(CRM_CURSOR), 10);

    // Перший запуск: нічого не переносимо заднім числом, лише запам'ятовуємо позицію.
    if (!seen) { props.setProperty(CRM_CURSOR, String(last)); return; }
    if (last <= seen) { props.setProperty(CRM_CURSOR, String(last)); return; }

    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    var rows = sh.getRange(seen + 1, 1, last - seen, sh.getLastColumn()).getDisplayValues();

    for (var i = 0; i < rows.length; i++) {
      crmAppend_(crm, pick_(head, rows[i]));
      props.setProperty(CRM_CURSOR, String(seen + 1 + i));
    }
  } finally {
    lock.releaseLock();
  }
}

/* Рядок анкети → поля, які нас цікавлять, за назвами колонок. */
function pick_(head, row) {
  var o = {};
  for (var i = 0; i < head.length; i++) o[String(head[i]).trim()] = String(row[i] == null ? '' : row[i]).trim();
  return o;
}

/* Дописує рядок у CRM. Колонки шукаємо за назвою в першому рядку, а не за
   номером: у CRM їх можуть переставити, і тоді дані не поїдуть не в ті поля. */
function crmAppend_(crm, d) {
  var head = crm.getRange(1, 1, 1, crm.getLastColumn()).getDisplayValues()[0];
  var val = {
    'Дата': crmDate_(d.sent),
    'Ім\'я': d.name,
    'Telegram': d.nik_tg,
    'Источник': d.type || 'Передзапис',
    'Статус': CRM_STATUS
  };
  var row = head.map(function (h) {
    var k = String(h).trim();
    return val.hasOwnProperty(k) ? val[k] : '';
  });
  crm.getRange(crm.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

/* sent лежить текстом «yyyy-MM-dd HH:mm:ss». Віддаємо справжню дату, бо дашборд
   фільтрує період по датах — текст він би просто не побачив. */
function crmDate_(sent) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(sent || ''));
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/* Разово перенести в CRM заявки, які вже є в таблиці, від заданої дати. */
function crmSendSince() {
  var FROM_DATE = '2026-10-31';   // формат yyyy-MM-dd

  var sh = book_().getSheetByName(NOTIFY_SHEET);
  var crm = SpreadsheetApp.openById(CRM_ID).getSheetByName(CRM_SHEET);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getDisplayValues();
  var col = head.indexOf('sent');
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][col]).trim() < FROM_DATE) continue;
    crmAppend_(crm, pick_(head, rows[i]));
    n++;
  }
  Logger.log('Перенесено в CRM: ' + n);
}
