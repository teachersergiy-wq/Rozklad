# Google Sheets backup for V2

Файл `Code.gs` призначений для прив'язаного Google Apps Script проєкту, який працює з Google Таблицею.

## Налаштування

1. Відкрийте потрібну Google Таблицю → **Розширення → Apps Script**.
2. Вставте в проєкт код із `Code.gs).
3. У **Project Settings → Script properties** створіть чотири властивості:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `TEACHER_EMAIL`
   - `TEACHER_SECRET`
4. Значення `TEACHER_SECRET` вводьте лише безпосередньо в Script properties. Не вставляйте його в код, чат, GitHub чи `ai_collab_log`.
5. У **Project Settings → Time zone** встановіть `Europe/Kyiv`, щоб `DAILY_BACKUP_HOUR` відповідав київському часу.
6. Один раз запустіть функцію `createDailyTrigger` і надайте Google необхідні дозволи. Вона створює один щоденний time-driven trigger о `02:00`.
7. Для ручної перевірки запустіть `runBackup`. У таблиці автоматично з'явиться аркуш `V2_Backup_Lessons`.

## Що зберігається

Код автентифікує викладача через Supabase Auth, викликає `v2_export_full_backup()` і переносить уроки у сплощений вигляд:

**Дата | Час | Учень | Тема | Домашнє завдання | Статус | Оплата | Сума | Спосіб оплати**

Перший щоденний запуск повністю оновлює аркуш актуальним набором уроків. Окремо в `K1:K2` записується час останнього backup.

GitHub Actions і Google Apps Script використовують одну й ту саму серверну функцію `v2_export_full_backup()`; окремий привілейований ключ бази даних для backup не потрібен.
