ALTER TABLE public.academic_harvest
  ADD COLUMN IF NOT EXISTS page text,
  ADD COLUMN IF NOT EXISTS homework text;