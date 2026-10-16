/**
 * New Rozklad — free Google Sheets backup.
 *
 * Script Properties required:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   TEACHER_EMAIL
 *   TEACHER_SECRET
 *
 * Keep the secret only in Script Properties.
 */

const BACKUP_SHEET_NAME = 'V2_Backup_Lessons';
const DAILY_BACKUP_HOUR = 2;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Резервне копіювання V2')
    .addItem('Створити backup зараз', 'runBackup')
    .addItem('Створити щоденний тригер', 'createDailyTrigger')
    .addToUi();
}

function createDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers
    .filter(t => t.getHandlerFunction() === 'runBackup')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('runBackup')
    .timeBased()
    .everyDays(1)
    .atHour(DAILY_BACKUP_HOUR)
    .create();
}

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  const cfg = {
    url: (p.getProperty('SUPABASE_URL') || '').replace(/\/+$/, ''),
    anonKey: p.getProperty('SUPABASE_ANON_KEY') || '',
    email: p.getProperty('TEACHER_EMAIL') || '',
    secret: p.getProperty('TEACHER_SECRET') || ''
  };
  Object.keys(cfg).forEach(key => {
    if (!cfg[key]) throw new Error('Не задано Script Property: ' + key);
  });
  return cfg;
}

function fetchJson_(url, options, errorPrefix) {
  const response = UrlFetchApp.fetch(
    url,
    Object.assign({ muteHttpExceptions: true }, options)
  );
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(errorPrefix + ' (HTTP ' + code + ')');
  }

  try {
    return JSON.parse(response.getContentText());
  } catch (e) {
    throw new Error(errorPrefix + ': сервер повернув не JSON.');
  }
}

function authenticateTeacher_(cfg) {
  const result = fetchJson_(
    cfg.url + '/auth/v1/token?grant_type=password',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: cfg.anonKey },
      payload: JSON.stringify({
        email: cfg.email,
        password: cfg.secret
      })
    },
    'Не вдалося автентифікувати викладача'
  );

  if (!result.access_token) {
    throw new Error('Supabase Auth не повернув access_token.');
  }
  return result.access_token;
}

function exportBackup_(cfg, accessToken) {
  return fetchJson_(
    cfg.url + '/rest/v1/rpc/v2_export_full_backup',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + accessToken
      },
      payload: '{}'
    },
    'Не вдалося отримати V2 backup'
  );
}

function runBackup() {
  const cfg = getConfig_();
  const accessToken = authenticateTeacher_(cfg);
  const backup = exportBackup_(cfg, accessToken);

  if (!backup || backup.format_version !== 1 || !Array.isArray(backup.lessons)) {
    throw new Error('Backup має несподіваний формат.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Скрипт має бути привʼязаний до Google Таблиці.');

  const sheet =
    ss.getSheetByName(BACKUP_SHEET_NAME) ||
    ss.insertSheet(BACKUP_SHEET_NAME);

  const students = Array.isArray(backup.students) ? backup.students : [];
  const studentMap = {};
  students.forEach(student => {
    studentMap[String(student.id)] = student;
  });

  const headers = [
    'Дата',
    'Час',
    'Учень',
    'Тема',
    'Домашнє завдання',
    'Статус',
    'Оплата',
    'Сума',
    'Спосіб оплати'
  ];

  const rows = backup.lessons
    .map(lesson => {
      const student = studentMap[String(lesson.student_id)] || {};
      return [
        lesson.lesson_date || '',
        lesson.lesson_time || '',
        student.name || '',
        lesson.topic || '',
        lesson.homework || '',
        lesson.status || '',
        lesson.paid ? 'Оплачено' : 'Не оплачено',
        lesson.paid_amount == null ? '' : Number(lesson.paid_amount),
        lesson.paid_method || ''
      ];
    })
    .sort((a, b) =>
      String(a[0]).localeCompare(String(b[0])) ||
      String(a[1]).localeCompare(String(b[1])) ||
      String(a[2]).localeCompare(String(b[2]))
    );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.getRange('K1').setValue('Останнє резервне копіювання');
  sheet.getRange('K2').setValue(backup.exported_at || new Date().toISOString());
  sheet.autoResizeColumns(1, headers.length);
}
