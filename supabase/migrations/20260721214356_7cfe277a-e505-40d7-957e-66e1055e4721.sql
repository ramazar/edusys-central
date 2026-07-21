
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS attendance_code text;
ALTER TABLE public.worker_attendance ADD COLUMN IF NOT EXISTS check_in timestamptz;
ALTER TABLE public.worker_attendance ADD COLUMN IF NOT EXISTS check_out timestamptz;

DO $$
DECLARE r record; c text;
BEGIN
  FOR r IN SELECT id FROM public.workers WHERE attendance_code IS NULL LOOP
    LOOP
      c := lpad((floor(random()*900000)+100000)::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workers WHERE attendance_code = c);
    END LOOP;
    UPDATE public.workers SET attendance_code = c WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS workers_attendance_code_key ON public.workers(attendance_code);
