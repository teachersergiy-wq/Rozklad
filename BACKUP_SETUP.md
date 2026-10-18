# Зовнішні резервні копії Supabase

Це інструкція і шаблон для приватного репозиторію `teachersergiy-wq/rozklad-backups`. Шаблон навмисно не розміщений у `.github/workflows` репозиторію Rozklad: автоматичне завдання має працювати тільки в приватному сховищі.

## Що буде збережено

Workflow раз на день створюватиме логічний дамп PostgreSQL через Supabase CLI: ролі, схему та дані. Дамп шифрується за допомогою age і публікується як asset приватного GitHub Release. Незашифровані файли існують лише на тимчасовому GitHub runner і видаляються після створення шифротексту.

Workflow перевіряє через GitHub API, що репозиторій призначення справді приватний. Якщо перевірка не пройде, дамп не запускається. У публічний Rozklad жодні копії даних не записуються.

Це резервна копія PostgreSQL, а не повний експорт усіх налаштувань Supabase: CLI виключає керовані схеми Auth і Storage, а Edge Functions, налаштування входу та API secrets потребують окремого збереження. У перевіреному проєкті зараз немає Storage buckets, але є активна Edge Function `ai-public-context`. Її код треба зберігати окремо для повного відновлення.

## Потрібні налаштування

1. Створіть приватний GitHub-репозиторій `teachersergiy-wq/rozklad-backups`. Увімкніть GitHub Actions для нього.
2. На своєму комп’ютері встановіть офіційний age і створіть пару ключів:
   ```powershell
   age-keygen -o "$env:USERPROFILE\rozklad-backup-age.txt"
   ```
   У файлі буде приватний ключ, а рядок-коментар міститиме публічний ключ `age1…`. Збережіть файл із приватним ключем у двох безпечних офлайн-місцях. Не надсилайте його в чат і не додавайте до GitHub. Якщо втратити приватний ключ, розшифрувати копії буде неможливо.
3. У приватному репозиторії відкрийте **Settings → Secrets and variables → Actions**:
   - створіть **secret** `SUPABASE_DB_URL` зі строкою підключення до PostgreSQL із Supabase **Connect**. Використайте Session pooler (порт 5432) або Direct connection, якщо ваша мережа підтримує IPv6. Не надсилайте пароль у чат;
   - створіть **variable** `AGE_RECIPIENT` зі значенням публічного ключа `age1…`. Це не секрет, приватний ключ до workflow не передається.
4. У приватному репозиторії створіть файл `.github/workflows/db-backup.yml` і вставте шаблон нижче.
5. Відкрийте **Actions → Encrypted Supabase database backup → Run workflow** і запустіть першу копію вручну.
6. Перевірте, що запуск завершився успішно, а в приватному репозиторії з’явився Release з двома файлами: `.tar.gz.age` та `.sha256`. Запланований запуск відбуватиметься щодня о 03:17 UTC.
7. Зробіть пробне відновлення лише в окремий тимчасовий Supabase-проєкт. Не запускайте restore на робочому Rozklad.
8. Після успішної перевірки узгодьте строк зберігання старих Release. Шаблон нічого автоматично не видаляє.

## Workflow-шаблон

```yaml
name: Encrypted Supabase database backup

on:
  workflow_dispatch:
  schedule:
    - cron: "17 3 * * *"

permissions:
  contents: write

concurrency:
  group: external-supabase-backup
  cancel-in-progress: false

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
      AGE_RECIPIENT: ${{ vars.AGE_RECIPIENT }}

    steps:
      - name: Check private destination and settings
        env:
          GH_TOKEN: ${{ github.token }}
        shell: bash
        run: |
          set -euo pipefail
          test "$GITHUB_REPOSITORY" = "teachersergiy-wq/rozklad-backups"
          is_private="$(gh api "repos/$GITHUB_REPOSITORY" --jq '.private')"
          if [[ "$is_private" != "true" ]]; then
            echo "::error::Backup destination must be a private repository."
            exit 1
          fi
          test -n "$SUPABASE_DB_URL"
          test -n "$AGE_RECIPIENT"

      - name: Install age
        shell: bash
        run: |
          sudo apt-get update
          sudo apt-get install --yes --no-install-recommends age

      - name: Set up pinned Supabase CLI
        uses: supabase/setup-cli@bea637206310b05056109c4ffab256b2c3c522af
        with:
          version: 2.121.0

      - name: Dump and encrypt database
        id: dump
        shell: bash
        run: |
          set -euo pipefail
          umask 077
          backup_dir="$(mktemp -d)"
          timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
          plain_archive="$RUNNER_TEMP/rozklad-db-$timestamp.tar.gz"
          encrypted_archive="$plain_archive.age"
          checksum_file="$encrypted_archive.sha256"
          cleanup() {
            rm -rf -- "$backup_dir"
            rm -f -- "$plain_archive"
          }
          trap cleanup EXIT

          supabase db dump --db-url "$SUPABASE_DB_URL" -f "$backup_dir/roles.sql" --role-only
          supabase db dump --db-url "$SUPABASE_DB_URL" -f "$backup_dir/schema.sql"
          supabase db dump --db-url "$SUPABASE_DB_URL" -f "$backup_dir/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

          test -s "$backup_dir/roles.sql"
          test -s "$backup_dir/schema.sql"
          test -s "$backup_dir/data.sql"
          cat > "$backup_dir/manifest.txt" <<EOF
          created_at_utc=$timestamp
          supabase_cli_version=2.121.0
          format=Supabase CLI SQL dump: roles.sql, schema.sql, data.sql
          EOF

          tar -C "$backup_dir" -czf "$plain_archive" roles.sql schema.sql data.sql manifest.txt
          age --recipient "$AGE_RECIPIENT" --output "$encrypted_archive" "$plain_archive"
          sha256sum "$encrypted_archive" | awk '{print $1}' > "$checksum_file"

          echo "timestamp=$timestamp" >> "$GITHUB_OUTPUT"
          echo "encrypted_archive=$encrypted_archive" >> "$GITHUB_OUTPUT"
          echo "checksum_file=$checksum_file" >> "$GITHUB_OUTPUT"

      - name: Publish encrypted backup as a private Release
        env:
          GH_TOKEN: ${{ github.token }}
          BACKUP_TIMESTAMP: ${{ steps.dump.outputs.timestamp }}
          ENCRYPTED_ARCHIVE: ${{ steps.dump.outputs.encrypted_archive }}
          CHECKSUM_FILE: ${{ steps.dump.outputs.checksum_file }}
        shell: bash
        run: |
          set -euo pipefail
          gh release create "backup-$BACKUP_TIMESTAMP" \
            "$ENCRYPTED_ARCHIVE" \
            "$CHECKSUM_FILE" \
            --repo "$GITHUB_REPOSITORY" \
            --title "Rozklad database backup $BACKUP_TIMESTAMP" \
            --notes "Encrypted logical PostgreSQL backup. Decryption key is stored offline."

      - name: Remove encrypted temporary files
        if: always()
        env:
          ENCRYPTED_ARCHIVE: ${{ steps.dump.outputs.encrypted_archive }}
          CHECKSUM_FILE: ${{ steps.dump.outputs.checksum_file }}
        shell: bash
        run: |
          rm -f -- "$ENCRYPTED_ARCHIVE" "$CHECKSUM_FILE"
```

## Перевірка відновлення

1. Створіть окремий тимчасовий Supabase-проєкт і скопіюйте його connection string у локальну змінну PowerShell. Не використовуйте connection string робочого проєкту:
   ```powershell
   $env:RESTORE_DB_URL = "<connection string нового тимчасового проєкту>"
   ```
2. Завантажте обидва файли з потрібного приватного Release. Перевірте, що SHA-256 збігається з вмістом відповідного файлу `.sha256`:
   ```powershell
   $expected = (Get-Content .\rozklad-db-<timestamp>.tar.gz.age.sha256 -Raw).Trim()
   $actual = (Get-FileHash .\rozklad-db-<timestamp>.tar.gz.age -Algorithm SHA256).Hash.ToLowerInvariant()
   if ($actual -ne $expected) { throw "Checksum does not match." }
   ```
3. Розшифруйте копію локально, використовуючи приватний ключ:
   ```powershell
   age --decrypt --identity "$env:USERPROFILE\rozklad-backup-age.txt" --output .\restore.tar.gz .\rozklad-db-<timestamp>.tar.gz.age
   tar -xzf .\restore.tar.gz
   ```
4. Після встановлення PostgreSQL client tools відновіть лише в порожній тимчасовий проєкт:
   ```powershell
   psql --single-transaction --variable ON_ERROR_STOP=1 --file .\roles.sql --file .\schema.sql --command "SET session_replication_role = replica" --file .\data.sql --dbname $env:RESTORE_DB_URL
   ```
5. Перевірте схеми, таблиці та кількість записів у таблицях V2 на тимчасовому проєкті. Порівняйте їх із робочим проєктом на момент знімка. Не переносьте тестові дані у робочий Rozklad.
6. Видаліть тимчасовий Supabase-проєкт після завершення перевірки, якщо він більше не потрібен.

Якщо restore завершується помилкою ролі або розширення, зупиніться й перегляньте помилку окремо. Не виправляйте її командами на робочому проєкті.

## Документація Supabase

- [Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI: db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
