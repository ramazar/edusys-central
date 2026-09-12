ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_school_grade_number_key;
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_grade_id_section_number_key;
ALTER TABLE public.sections ADD CONSTRAINT sections_school_grade_number_gender_key UNIQUE (school_id, grade_id, section_number, gender);