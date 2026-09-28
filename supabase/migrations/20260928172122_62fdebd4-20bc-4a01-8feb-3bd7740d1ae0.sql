-- Allow several notes for the same student on the same day.
-- Notes are daily_marks rows with max_score = 0; real marks keep the
-- one-per-student-per-day-per-subject rule.
ALTER TABLE public.daily_marks DROP CONSTRAINT IF EXISTS daily_marks_student_id_date_subject_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_marks_student_date_subject_marks_key
  ON public.daily_marks (student_id, date, subject)
  WHERE max_score > 0;
