## Add worker check-in/out by code (mirror teachers)

Mirror the teacher code-scan flow for workers, with daily-reset attendance and a monthly history view.

### Database (migration)
- Add `code text unique` and `check_in timestamptz`, `check_out timestamptz` to `public.workers` (nullable). Backfill all existing workers with a random unique 6-digit code.
- Attendance already lives in `worker_attendance` (unique per `worker_id, date`) — used to persist daily records so history is queryable per month.

### Workers page (`src/routes/_authenticated/workers.tsx`)
- Add a scan/entry input at the top: type or scan the worker code + Enter.
  - First scan of the day → sets `check_in = now()`, upserts `worker_attendance` row (status `present`) for today, toast "تم تسجيل الحضور".
  - Second scan same day → sets `check_out = now()`, toast "تم تسجيل الانصراف".
  - Third scan same day → toast "تم التسجيل مسبقًا".
- Daily reset: at the start of a new day (no `worker_attendance` row for today for that worker), treat next scan as check-in again. `check_in`/`check_out` columns are updated to reflect the latest day's timestamps; the durable per-day record is the `worker_attendance` row (date + created_at as check-in time, plus we'll store check-out timestamp).
- Add `check_out_at timestamptz` to `worker_attendance` in the same migration so both timestamps are preserved per day for history.
- Table columns: الاسم | الوظيفة | الرمز | حضور اليوم (badge + دخول/خروج times) | إجراءات (سجل الشهر).
- Keep the existing manual حاضر/غائب buttons for reception overrides.
- Add worker dialog: auto-generate a 6-digit code (editable), same as teachers.

### Monthly history dialog
- Button "سجل الشهر" per worker opens a dialog with a month picker (default: current month).
- Shows a table: التاريخ | وقت الدخول | وقت الخروج | الحالة, sourced from `worker_attendance` filtered by month for that worker.
- Lets admin/accountant answer "did he come last week?" by scrolling the month view.

### Out of scope
- No payroll/salary UI (removed previously, stays removed).
- No PDF export for worker attendance in this pass (can be added later if you want it).
