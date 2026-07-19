
-- ============ ROLES & PROFILES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'reception', 'teacher');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE POLICY "authenticated_read_profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own_update_profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "admin_manage_profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "read_own_roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GRADES & SECTIONS ============
CREATE TABLE public.grades (
  id INT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_grades" ON public.grades FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_grades" ON public.grades FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.grades (id, name_ar) VALUES
(1,'الصف الأول'),(2,'الصف الثاني'),(3,'الصف الثالث'),(4,'الصف الرابع'),
(5,'الصف الخامس'),(6,'الصف السادس'),(7,'الصف السابع'),(8,'الصف الثامن'),
(9,'الصف التاسع'),(10,'الصف العاشر'),(11,'الصف الحادي عشر'),(12,'الصف الثاني عشر');

CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id INT NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
  section_number INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(grade_id, section_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_sections" ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_sections" ON public.sections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  grade_id INT NOT NULL REFERENCES public.grades(id),
  section_id UUID NOT NULL REFERENCES public.sections(id),
  gender TEXT,
  birth_date DATE,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_relation TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_students_section ON public.students(section_id);
CREATE INDEX idx_students_grade ON public.students(grade_id);

CREATE POLICY "read_students_all_staff" ON public.students FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception','teacher']::app_role[])
);
CREATE POLICY "manage_students_admin_reception" ON public.students FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','reception']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','reception']::app_role[]));

CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYMENT PLANS & PAYMENTS ============
CREATE TABLE public.student_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_payment_plans TO authenticated;
GRANT ALL ON public.student_payment_plans TO service_role;
ALTER TABLE public.student_payment_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_plans_student ON public.student_payment_plans(student_id);
CREATE POLICY "read_plans" ON public.student_payment_plans FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
);
CREATE POLICY "manage_plans" ON public.student_payment_plans FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

CREATE TABLE public.student_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  reference TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_payments TO authenticated;
GRANT ALL ON public.student_payments TO service_role;
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payments_student ON public.student_payments(student_id);
CREATE POLICY "read_payments" ON public.student_payments FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
);
CREATE POLICY "manage_payments" ON public.student_payments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

-- ============ ATTENDANCE ============
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late');

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, date);
CREATE POLICY "read_attendance" ON public.attendance FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception','teacher']::app_role[])
);
CREATE POLICY "manage_attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','reception','teacher']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','reception','teacher']::app_role[]));
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DAILY MARKS ============
CREATE TABLE public.daily_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  subject TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 10,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, date, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_marks TO authenticated;
GRANT ALL ON public.daily_marks TO service_role;
ALTER TABLE public.daily_marks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_marks_student_date ON public.daily_marks(student_id, date);
CREATE POLICY "read_marks" ON public.daily_marks FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception','teacher']::app_role[])
);
CREATE POLICY "manage_marks" ON public.daily_marks FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','reception','teacher']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','reception','teacher']::app_role[]));

-- ============ TEACHERS ============
CREATE TYPE public.salary_type AS ENUM ('fixed','hourly');

CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  salary_type salary_type NOT NULL DEFAULT 'fixed',
  salary_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_teachers" ON public.teachers FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception','teacher']::app_role[])
);
CREATE POLICY "manage_teachers" ON public.teachers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_teachers_updated_at BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.teacher_section_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, section_id, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_section_assignments TO authenticated;
GRANT ALL ON public.teacher_section_assignments TO service_role;
ALTER TABLE public.teacher_section_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_assignments" ON public.teacher_section_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_assignments" ON public.teacher_section_assignments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.teacher_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_from DATE,
  period_to DATE,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_payments TO authenticated;
GRANT ALL ON public.teacher_payments TO service_role;
ALTER TABLE public.teacher_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_teacher_payments" ON public.teacher_payments FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[])
);
CREATE POLICY "manage_teacher_payments" ON public.teacher_payments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

-- ============ WORKERS ============
CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  job_title TEXT,
  salary_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_workers" ON public.workers FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
);
CREATE POLICY "manage_workers" ON public.workers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_workers_updated_at BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.worker_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(worker_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_attendance TO authenticated;
GRANT ALL ON public.worker_attendance TO service_role;
ALTER TABLE public.worker_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_worker_attendance" ON public.worker_attendance FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
);
CREATE POLICY "manage_worker_attendance" ON public.worker_attendance FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','reception']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','reception']::app_role[]));

CREATE TABLE public.worker_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_from DATE,
  period_to DATE,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_payments TO authenticated;
GRANT ALL ON public.worker_payments TO service_role;
ALTER TABLE public.worker_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_worker_payments" ON public.worker_payments FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[])
);
CREATE POLICY "manage_worker_payments" ON public.worker_payments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

-- ============ FINANCE ============
CREATE TABLE public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_entries TO authenticated;
GRANT ALL ON public.income_entries TO service_role;
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_income" ON public.income_entries FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
);
CREATE POLICY "manage_income" ON public.income_entries FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_expenses" ON public.expenses FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
);
CREATE POLICY "manage_expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

-- ============ DOCUMENTS ============
CREATE TABLE public.student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  document_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_documents TO authenticated;
GRANT ALL ON public.student_documents TO service_role;
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_docs" ON public.student_documents FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
);
CREATE POLICY "manage_docs" ON public.student_documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','reception']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','reception']::app_role[]));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "auth_insert_audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
