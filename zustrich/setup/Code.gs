/**
 * Приймач заявок з сайту «Індивідуальна онлайн-зустріч».
 *
 * Замінює собою те, що раніше робив сервер Tilda:
 *   1) записує заявку в Google Таблицю;
 *   2) надсилає вам повідомлення в Telegram.
 *
 * ВАЖЛИВО: справжні токени вставляються ТІЛЬКИ у вікні Google Apps Script.
 * Не вписуйте їх у файл, що лежить у репозиторії, — він доступний усім в інтернеті.
 */

/* ======================= НАЛАШТУВАННЯ ======================= */

/** ID Google Таблиці — це частина адреси між /d/ та /edit
 *  https://docs.google.com/spreadsheets/d/ЦЕЙ_РЯДОК/edit                    */
const SHEET_ID = 'ВСТАВТЕ_ID_ТАБЛИЦІ';

/** Назва аркуша всередині таблиці. Якщо такого немає — створиться сам.      */
const SHEET_NAME = 'Заявки';

/** Токен бота від @BotFather                                               */
const TELEGRAM_TOKEN = 'ВСТАВТЕ_ТОКЕН_БОТА';

/** chat_id Анни — саме їй приходитимуть заявки (як дізнатися — README, крок 4) */
const TELEGRAM_CHAT_ID = 'ВСТАВТЕ_ВАШ_CHAT_ID';

/** Чи писати в Telegram про тих, хто не дійшов до контактів
 *  (обрав «не готов(а) інвестувати»). У таблицю вони потрапляють завжди.    */
const NOTIFY_WITHOUT_CONTACTS = false;

/* ============================================================= */

const COLUMNS = [
  {title: 'Дата',              key: 'Дата'},
  {title: 'Ім’я',         key: 'Name'},
  {title: 'Телефон',           key: 'Phone'},
  {title: 'Telegram',          key: 'Telegram'},
  {title: 'Проблема',          key: 'Problema'},
  {title: 'Спроби вирішити',   key: 'Sproby'},
  {title: 'Наскільки болить',  key: 'Bolyt'},
  {title: 'Готовність вкласти',key: 'Groshi'},
  {title: 'Ідеальний результат', key: 'Resultat'},
  {title: 'Сторінка',          key: 'Сторінка'}
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    saveToSheet(data);

    if (data.Name || NOTIFY_WITHOUT_CONTACTS) {
      notifyTelegram(data);
    }
  } catch (err) {
    console.error('Помилка обробки заявки: ' + err);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ok: true}))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Відкривши адресу скрипта в браузері, ви побачите це повідомлення —
 *  зручно, щоб перевірити, що скрипт узагалі опубліковано. */
function doGet() {
  return ContentService.createTextOutput('Приймач заявок працює.');
}

function saveToSheet(data) {
  const book = SpreadsheetApp.openById(SHEET_ID);
  let sheet = book.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS.map(function (c) { return c.title; }));
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow(COLUMNS.map(function (c) { return data[c.key] || ''; }));
}

function notifyTelegram(data) {
  const lines = ['<b>Нова заявка з сайту</b>', ''];

  COLUMNS.forEach(function (c) {
    if (c.key === 'Сторінка') return;
    const value = data[c.key];
    if (value) lines.push('<b>' + c.title + ':</b> ' + escapeHtml(value));
  });

  if (!data.Name) {
    lines.push('', '<i>Контактів не залишила — обрала безкоштовний урок.</i>');
  }

  UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
    method: 'post',
    payload: {
      chat_id: TELEGRAM_CHAT_ID,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: 'true'
    },
    muteHttpExceptions: true
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Запустіть вручну в редакторі Apps Script, щоб перевірити налаштування
 *  без сайту: у таблиці має з'явитися рядок, а в Telegram — повідомлення. */
function testSend() {
  const sample = {
    'Дата': new Date().toLocaleString('uk-UA'),
    'Name': 'Тестова заявка',
    'Phone': '+380 00 000 00 00',
    'Telegram': '@test',
    'Problema': 'Самореалізація',
    'Sproby': 'Так, кілька разів',
    'Bolyt': '8',
    'Groshi': 'Готова інвестувати до $250',
    'Resultat': 'Перевірка налаштувань',
    'Сторінка': 'test'
  };
  saveToSheet(sample);
  notifyTelegram(sample);
}
