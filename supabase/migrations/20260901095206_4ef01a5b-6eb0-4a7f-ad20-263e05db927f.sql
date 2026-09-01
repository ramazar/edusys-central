CREATE TYPE public.currency_code AS ENUM ('SYP', 'USD');

ALTER TABLE public.income_entries ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'SYP';
ALTER TABLE public.expenses ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'SYP';
ALTER TABLE public.student_payments ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'SYP';
ALTER TABLE public.teacher_payments ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'SYP';
ALTER TABLE public.worker_payments ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'SYP';