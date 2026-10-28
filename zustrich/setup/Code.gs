/**
 * Приймач заявок з сайту «Індивідуальна онлайн-зустріч».
 *
 * Записує заявку в цю таблицю і надсилає повідомлення в Telegram.
 *
 * ПОТРІБНО ЗАПОВНИТИ ОДИН РЯДОК — токен бота, нижче.
 * Усе інше скрипт знайде сам, коли ви запустите функцію setup.
 */

const TELEGRAM_TOKEN = 'ВСТАВТЕ_ТОКЕН_БОТА';

/**
 * Необов'язково. Заповнюйте, тільки якщо беретe бота, у якого вже налаштований
 * вебхук (наприклад RespirarBot) — у такого getUpdates не працює, і знайти
 * chat_id автоматично не вийде.
 *
 * Як дізнатися: Анна пише боту @userinfobot — він відповість її номером Id.
 * Це число і є chat_id. Впишіть його між лапками.
 */
const CHAT_ID_MANUAL = '';


/**
 * Запустіть цю функцію один раз після того, як Анна написала боту.
 * Вона знайде її chat_id, збереже його і надішле їй тестове повідомлення.
 */
function setup() {
  if (TELEGRAM_TOKEN.indexOf('ВСТАВТЕ') === 0) {
    throw new Error('Спочатку вставте токен бота у рядок TELEGRAM_TOKEN угорі.');
  }

  if (CHAT_ID_MANUAL) {
    return finish(CHAT_ID_MANUAL, 'вказаний вручну чат');
  }

  const answer = telegram('getUpdates', {});

  if (answer.description && answer.description.indexOf('webhook') !== -1) {
    throw new Error(
      'У цього бота налаштований вебхук, тому знайти chat_id автоматично не можна. ' +
      'Попросіть Анну написати боту @userinfobot — він відповість її номером Id. ' +
      'Впишіть це число у рядок CHAT_ID_MANUAL угорі й запустіть setup ще раз.'
    );
  }

  if (!answer.ok) {
    throw new Error(
      'Telegram не прийняв токен. Перевірте, чи скопіювали його повністю. ' +
      'Відповідь: ' + (answer.description || '—')
    );
  }

  const updates = answer.result || [];
  if (!updates.length) {
    throw new Error(
      'Боту ще ніхто не писав. Попросіть Анну відкрити бота, натиснути Start ' +
      'і надіслати будь-яке повідомлення — потім запустіть setup ще раз.'
    );
  }

  const last = updates[updates.length - 1];
  const message = last.message || last.edited_message || last.channel_post;
  const chat = message && message.chat;

  if (!chat) {
    throw new Error('Не вдалося розпізнати чат. Напишіть боту ще раз і повторіть.');
  }

  return finish(chat.id, chat.first_name || chat.title || chat.username || 'чат');
}


/**
 * Допоміжна. Запустіть, щоб дізнатися, який саме бот стоїть у скрипті —
 * вона покаже його @ім'я і посилання, яке треба надіслати Анні.
 */
function botLink() {
  const me = telegram('getMe', {});

  if (!me.ok) {
    throw new Error('Токен не підходить. Telegram каже: ' + (me.description || '—'));
  }

  const link = 'https://t.me/' + me.result.username;
  const text = 'Бот: @' + me.result.username + '  →  ' + link;
  Logger.log(text);
  return text;
}


/** Зберігає chat_id, готує аркуш і надсилає перевірочне повідомлення. */
function finish(chatId, name) {
  PropertiesService.getScriptProperties().setProperty('CHAT_ID', String(chatId));

  prepareSheet();

  const sent = telegram('sendMessage', {
    chat_id: chatId,
    text: '<b>Приймач заявок налаштовано</b>\n\nСюди приходитимуть заявки з сайту.',
    parse_mode: 'HTML'
  });

  if (!sent.ok) {
    throw new Error(
      'Chat_id збережено, але повідомлення не пішло. Telegram каже: ' +
      (sent.description || '—') +
      '. Найчастіше це означає, що Анна ще не натиснула Start у цього бота.'
    );
  }

  const done = 'Готово. Заявки йтимуть у «' + name + '» (chat_id ' + chatId + '). ' +
               'Перевірте Telegram — там має бути повідомлення.';
  Logger.log(done);
  return done;
}


/* ====== Далі нічого міняти не треба ====== */

const COLUMNS = [
  {title: 'Дата',                key: 'Дата'},
  {title: 'Ім’я',           key: 'Name'},
  {title: 'Телефон',             key: 'Phone'},
  {title: 'Telegram',            key: 'Telegram'},
  {title: 'Проблема',            key: 'Problema'},
  {title: 'Спроби вирішити',     key: 'Sproby'},
  {title: 'Наскільки болить',    key: 'Bolyt'},
  {title: 'Готовність вкласти',  key: 'Groshi'},
  {title: 'Ідеальний результат', key: 'Resultat'},
  {title: 'Сторінка',            key: 'Сторінка'}
];

const SHEET_NAME = 'Заявки з сайту';


function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    saveToSheet(data);
    if (data.Name) notify(data);
  } catch (err) {
    console.error('Помилка обробки заявки: ' + err);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ok: true}))
    .setMimeType(ContentService.MimeType.JSON);
}


/** Відкривши адресу скрипта в браузері, побачите це повідомлення. */
function doGet() {
  return ContentService.createTextOutput('Приймач заявок працює.');
}


function prepareSheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);

  if (!sheet) sheet = book.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS.map(function (c) { return c.title; }));
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}


function saveToSheet(data) {
  prepareSheet().appendRow(COLUMNS.map(function (c) { return data[c.key] || ''; }));
}


function notify(data) {
  const chatId = PropertiesService.getScriptProperties().getProperty('CHAT_ID');
  if (!chatId) return;

  const lines = ['<b>Нова заявка з сайту</b>', ''];

  COLUMNS.forEach(function (c) {
    if (c.key === 'Сторінка') return;
    if (data[c.key]) lines.push('<b>' + c.title + ':</b> ' + escapeHtml(data[c.key]));
  });

  telegram('sendMessage', {
    chat_id: chatId,
    text: lines.join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: 'true'
  });
}


function telegram(method, payload) {
  const response = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/' + method,
    {method: 'post', payload: payload, muteHttpExceptions: true}
  );
  return JSON.parse(response.getContentText());
}


function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
