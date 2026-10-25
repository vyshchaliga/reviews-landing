/**
 * Веб-застосунок Google Apps Script: дописує рядок анкети в таблицю.
 * Код прив'язується до таблиці «БД заявок» (Розширення → Apps Script).
 * Пише у вкладку SHEET_NAME; колонки підбираються за назвами в першому рядку
 * (sent, name, nik_tg, instagram, dohod, rol, utm_*, referer, type ...). Зайвих колонок не чіпає.
 */
var SHEET_NAME = 'Анкета предзапису';   // сира вкладка; «БД заявок» збирається з неї формулою, тому в неї писати не можна
var SECRET = 'ЗАМІНИ_НА_ДОВІЛЬНИЙ_РЯДОК';   // такий самий має бути в Vercel: SHEETS_SECRET

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body || body.secret !== SECRET) return out_({ ok: false, error: 'forbidden' });
    var d = body.data || {};

    lock.waitLock(20000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) return out_({ ok: false, error: 'no sheet' });

    d.sent = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd HH:mm:ss');
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = head.map(function (h) {
      var v = d[String(h).trim()];
      return v == null ? '' : v;
    });
    var r = sh.getLastRow() + 1;
    var rng = sh.getRange(r, 1, 1, row.length);
    rng.setNumberFormat('@');            // усе як текст: нік @name, суми, «+380…» не перетворюються
    rng.setValues([row]);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
