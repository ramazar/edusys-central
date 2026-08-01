-- 1. schools table
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER schools_set_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. new role value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 3. membership + active school columns
ALTER TABLE public.user_roles ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN active_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

-- 4. school_id on every tenant table
ALTER TABLE public.students ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.sections ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teachers ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.workers ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.daily_marks ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.homework_assignments ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.homework_records ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.academic_harvest ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_payments ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_payment_plans ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_documents ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_attendance ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_lecture_types ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_lectures ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_payments ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_section_assignments ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.worker_attendance ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.worker_payments ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.income_entries ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- 5. backfill: create the first school from the existing branding name
INSERT INTO public.schools (name, logo_url)
SELECT COALESCE(NULLIF((SELECT value FROM public.app_settings WHERE key = 'school_name'), ''), 'المدرسة الأولى'),
       (SELECT value FROM public.app_settings WHERE key = 'logo_url');

DO $mig$
DECLARE
  sid uuid;
  t text;
  tables text[] := ARRAY[
    'students','sections','teachers','workers','attendance','daily_marks',
    'homework_assignments','homework_records','academic_harvest','student_payments',
    'student_payment_plans','student_documents','teacher_attendance','teacher_lecture_types',
    'teacher_lectures','teacher_payments','teacher_section_assignments','worker_attendance',
    'worker_payments','income_entries','expenses','audit_logs','notifications','app_settings'
  ];
BEGIN
  SELECT id INTO sid FROM public.schools ORDER BY created_at LIMIT 1;
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE public.%I SET school_id = %L WHERE school_id IS NULL', t, sid);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (school_id)', 'idx_' || t || '_school_id', t);
  END LOOP;
  UPDATE public.user_roles SET school_id = sid WHERE school_id IS NULL;
  UPDATE public.profiles SET active_school_id = sid WHERE active_school_id IS NULL;
END
$mig$;

-- app_settings is now keyed per school
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE public.app_settings ADD PRIMARY KEY (school_id, key);

-- unique membership rows
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX user_roles_user_school_role_key
  ON public.user_roles (user_id, COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid), role);
CREATE INDEX IF NOT EXISTS idx_user_roles_school ON public.user_roles (school_id);

-- 6. helper functions
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT active_school_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.user_in_school(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_in_school(auth.uid(), _school_id) OR public.is_super_admin(auth.uid())
$$;

-- role helpers become scoped to the caller's active school
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
      AND ur.school_id = (SELECT p.active_school_id FROM public.profiles p WHERE p.id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = ANY(_roles)
      AND ur.school_id = (SELECT p.active_school_id FROM public.profiles p WHERE p.id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text = 'admin'
      AND ur.school_id = (SELECT p.active_school_id FROM public.profiles p WHERE p.id = _user_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.current_school_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_in_school(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid) FROM anon;

-- only a school you belong to may become your active school
CREATE OR REPLACE FUNCTION public.validate_active_school()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active_school_id IS NOT NULL
     AND NOT public.user_in_school(NEW.id, NEW.active_school_id)
     AND NOT public.is_super_admin(NEW.id) THEN
    RAISE EXCEPTION 'المستخدم غير مسجل في هذه المدرسة';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER profiles_validate_active_school
  BEFORE INSERT OR UPDATE OF active_school_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_active_school();

-- 7. tenant isolation: restrictive policies + defaults
DO $mig2$
DECLARE
  t text;
  tables text[] := ARRAY[
    'students','sections','teachers','workers','attendance','daily_marks',
    'homework_assignments','homework_records','academic_harvest','student_payments',
    'student_payment_plans','student_documents','teacher_attendance','teacher_lecture_types',
    'teacher_lectures','teacher_payments','teacher_section_assignments','worker_attendance',
    'worker_payments','income_entries','expenses','audit_logs','notifications','app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id SET DEFAULT public.current_school_id()', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (school_id = public.current_school_id() OR public.is_super_admin(auth.uid()))
      WITH CHECK (school_id = public.current_school_id() OR public.is_super_admin(auth.uid()))$f$, t);
  END LOOP;
END
$mig2$;

-- app_settings was publicly readable; branding is now per school and staff-only
DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.app_settings FROM anon;

-- 8. schools policies
CREATE POLICY schools_read_members ON public.schools FOR SELECT TO authenticated
  USING (public.is_member_of(id));
CREATE POLICY schools_super_admin_manage ON public.schools FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 9. user_roles policies scoped per school, super_admin not grantable by admins
DROP POLICY IF EXISTS read_own_roles ON public.user_roles;
DROP POLICY IF EXISTS admin_insert_roles ON public.user_roles;
DROP POLICY IF EXISTS admin_update_roles ON public.user_roles;
DROP POLICY IF EXISTS admin_delete_roles ON public.user_roles;

CREATE POLICY read_own_roles ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (public.is_admin(auth.uid()) AND school_id = public.current_school_id())
         OR public.is_super_admin(auth.uid()));
CREATE POLICY admin_insert_roles ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) AND school_id = public.current_school_id() AND role::text <> 'super_admin')
              OR public.is_super_admin(auth.uid()));
CREATE POLICY admin_update_roles ON public.user_roles FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) AND school_id = public.current_school_id() AND role::text <> 'super_admin')
         OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.is_admin(auth.uid()) AND school_id = public.current_school_id() AND role::text <> 'super_admin')
              OR public.is_super_admin(auth.uid()));
CREATE POLICY admin_delete_roles ON public.user_roles FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) AND school_id = public.current_school_id() AND role::text <> 'super_admin')
         OR public.is_super_admin(auth.uid()));

-- 10. profiles: admins only see people in their own school
DROP POLICY IF EXISTS users_read_own_profile ON public.profiles;
CREATE POLICY users_read_own_profile ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid()
         OR (public.is_admin(auth.uid()) AND public.user_in_school(id, public.current_school_id()))
         OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS admin_manage_profiles ON public.profiles;
CREATE POLICY admin_manage_profiles ON public.profiles FOR ALL TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.user_in_school(id, public.current_school_id()))
         OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.is_admin(auth.uid()) AND public.user_in_school(id, public.current_school_id()))
              OR public.is_super_admin(auth.uid()));

-- 11. new signups get no school until an admin assigns one
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;