CREATE TABLE public.teacher_lecture_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_lecture_types TO authenticated;
GRANT ALL ON public.teacher_lecture_types TO service_role;
ALTER TABLE public.teacher_lecture_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read lecture types" ON public.teacher_lecture_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage lecture types" ON public.teacher_lecture_types
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

CREATE TRIGGER trg_teacher_lecture_types_updated
  BEFORE UPDATE ON public.teacher_lecture_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.teacher_lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  lecture_type_id uuid REFERENCES public.teacher_lecture_types(id) ON DELETE SET NULL,
  type_name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  count integer NOT NULL DEFAULT 1,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_lectures TO authenticated;
GRANT ALL ON public.teacher_lectures TO service_role;
ALTER TABLE public.teacher_lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read lectures" ON public.teacher_lectures
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage lectures" ON public.teacher_lectures
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

CREATE INDEX idx_teacher_lectures_teacher_date ON public.teacher_lectures (teacher_id, date DESC);
CREATE INDEX idx_teacher_lecture_types_teacher ON public.teacher_lecture_types (teacher_id);