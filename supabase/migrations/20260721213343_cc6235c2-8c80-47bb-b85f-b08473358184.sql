
-- Add attendance_code to teachers
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS attendance_code TEXT UNIQUE;

-- Create teacher_attendance table
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_attendance TO authenticated;
GRANT ALL ON public.teacher_attendance TO service_role;

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view teacher attendance" ON public.teacher_attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/accountant/reception can manage teacher attendance" ON public.teacher_attendance
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[]));

CREATE TRIGGER teacher_attendance_updated_at BEFORE UPDATE ON public.teacher_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
