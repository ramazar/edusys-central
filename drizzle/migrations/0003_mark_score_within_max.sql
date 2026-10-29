-- Block new or edited marks whose score is above the top mark or below zero.
-- Note-only rows (max_score <= 0) are exempt. NOT VALID: existing wrong marks
-- stay until they are corrected, but any save of a row must satisfy the rule.
ALTER TABLE public.daily_marks
  ADD CONSTRAINT daily_marks_score_within_max
  CHECK (max_score <= 0 OR (score >= 0 AND score <= max_score)) NOT VALID;