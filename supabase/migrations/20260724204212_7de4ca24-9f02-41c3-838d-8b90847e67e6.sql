
CREATE TYPE public.homework_status AS ENUM ('done','not_done','partial');

CREATE TABLE public.homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id integer NOT NULL,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject text NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_assignments TO authenticated;
GRANT ALL ON public.homework_assignments TO service_role;

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read homework_assignments" ON public.homework_assignments
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception','accountant']::app_role[]));

CREATE POLICY "staff insert homework_assignments" ON public.homework_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception']::app_role[]));

CREATE POLICY "staff update homework_assignments" ON public.homework_assignments
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception']::app_role[]));

CREATE POLICY "admin delete homework_assignments" ON public.homework_assignments
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_hw_assignments_updated_at
  BEFORE UPDATE ON public.homework_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.homework_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.homework_status NOT NULL DEFAULT 'not_done',
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_records TO authenticated;
GRANT ALL ON public.homework_records TO service_role;

ALTER TABLE public.homework_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read homework_records" ON public.homework_records
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception','accountant']::app_role[]));

CREATE POLICY "staff write homework_records" ON public.homework_records
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception']::app_role[]));

CREATE TRIGGER set_hw_records_updated_at
  BEFORE UPDATE ON public.homework_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
