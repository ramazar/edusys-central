# Multi-school support (multi-tenancy)

Turn SchoolDesk into a system where several schools use the same site, each seeing only its own students, staff, attendance, marks, homework, harvest and finances.

## How it will work

- A new **schools** list (name, logo, active flag). Every record in the app belongs to exactly one school.
- A **super-admin** (you) gets a new "المدارس" screen to create schools, rename/deactivate them, and create each school's first admin account.
- Each user's roles become **per school**. A user can be a member of several schools (e.g. admin of one, accountant of another).
- The top bar gets a **school switcher** for users belonging to more than one school. The chosen school becomes the "active school" and everything on every page — sidebar, dashboard, lists, PDFs, branding — reflects only that school.
- All existing data (students, teachers, workers, finances, records) is moved into one first school, and today's users become that school's staff, so nothing is lost.

## Screens and changes

1. **/schools** (super-admin only): list of schools, create/edit/deactivate, and "add admin" for a school.
2. **Top bar**: school name shown next to the user; a dropdown to switch when the user has more than one school. Switching refreshes all data.
3. **الإعدادات**: user management becomes school-scoped — an admin only sees and manages users of the active school, and assigns roles within it. Branding (school name + logo) and sections move from global settings to per-school values.
4. **All existing pages**: every read and every create automatically filters/stamps the active school. No visible layout change beyond correct data.
5. **Login**: unchanged. After login, if the user has one school it is selected automatically; with several, the last used one is remembered.

## Technical section

### Database
- `schools` table: `id`, `name`, `logo_url`, `is_active`, timestamps. GRANTs + RLS.
- `app_role` enum gains `super_admin`.
- `user_roles` gains `school_id uuid` (NULL only for `super_admin`); unique on `(user_id, school_id, role)`.
- `profiles` gains `active_school_id uuid references schools(id)`.
- `school_id uuid not null references schools(id)` added to every tenant table: `students`, `sections`, `teachers`, `workers`, `attendance`, `daily_marks`, `homework_assignments`, `homework_records`, `academic_harvest`, `student_payments`, `student_payment_plans`, `student_documents`, `teacher_*` tables, `worker_*` tables, `income_entries`, `expenses`, `audit_logs`, `notifications`, `app_settings` (branding per school), with indexes on `school_id`.
- `grades` stays global (1–12 reference list).

### Backfill (same migration)
Insert one school from the current branding name, set `school_id` to it on every existing row, set it on every existing `user_roles` row and as `active_school_id` on every profile, then apply `NOT NULL`.

### Access rules
- `public.current_school_id()` — security definer, returns `profiles.active_school_id` for `auth.uid()`.
- `public.is_member_of(_school_id)` — security definer, true when the user has any role in that school.
- `has_role(_user_id, _role)` / `has_any_role` / `is_admin` gain school scoping: they check roles in `current_school_id()`. `super_admin` is checked with a separate `is_super_admin()` helper (school-independent).
- Rewrite every existing tenant-table policy to add `school_id = current_school_id()` on both `USING` and `WITH CHECK`, keeping the current role conditions.
- Setting `profiles.active_school_id` allowed only to a school the user is a member of (enforced by a `BEFORE UPDATE` trigger).
- `schools`: readable by members and super-admins; writable by super-admins only.
- `user_roles`: admins may manage roles only within their own school and may not grant `super_admin`; super-admins may manage anything.

### Application code
- `useAuth.ts`: `useMyRoles` becomes school-aware; add `useMySchools()`, `useActiveSchool()`, `setActiveSchool()`, and `isSuperAdmin`.
- New `SchoolSwitcher` component in `TopBar`; switching updates `active_school_id` and invalidates the query cache.
- `useBranding.ts` reads/writes branding for the active school; PDF/print helpers use it (they already read the cached value).
- Every insert path (students, teachers, workers, attendance, marks, homework, harvest, finance, audit logs) stamps `school_id` from the active school. Reads rely on RLS but also filter explicitly where it affects joins.
- `admin-users.functions.ts`: creating a user assigns roles inside the caller's school; delete restricted to same-school users. New server functions for school creation and creating a school admin, restricted to super-admins.
- New route `src/routes/_authenticated/schools.tsx` plus a sidebar entry visible only to super-admins.

### Rollout notes
Migration runs first (schema + backfill + policies), then code changes. Your current account will be granted `super_admin` in addition to its existing admin role in the first school.
