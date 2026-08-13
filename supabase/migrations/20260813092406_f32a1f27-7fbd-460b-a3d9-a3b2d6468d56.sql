DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'section_gender') THEN
    CREATE TYPE public.section_gender AS ENUM ('boys','girls');
  END IF;
END $$;

ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_grade_id_section_number_key;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS gender public.section_gender NOT NULL DEFAULT 'boys';

ALTER TABLE public.sections
  ADD CONSTRAINT sections_school_grade_number_key UNIQUE (school_id, grade_id, section_number);