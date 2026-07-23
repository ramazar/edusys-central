
CREATE TABLE public.academic_harvest (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_id INTEGER NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_harvest TO authenticated;
GRANT ALL ON public.academic_harvest TO service_role;

ALTER TABLE public.academic_harvest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_harvest" ON public.academic_harvest
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception','accountant']::app_role[]));

CREATE POLICY "staff_insert_harvest" ON public.academic_harvest
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception']::app_role[]));

CREATE POLICY "staff_update_harvest" ON public.academic_harvest
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','teacher','reception']::app_role[]));

CREATE POLICY "admin_delete_harvest" ON public.academic_harvest
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_academic_harvest_updated_at
  BEFORE UPDATE ON public.academic_harvest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_academic_harvest_section_date ON public.academic_harvest(section_id, date DESC);
CREATE INDEX idx_academic_harvest_grade_date ON public.academic_harvest(grade_id, date DESC);
