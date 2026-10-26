CREATE OR REPLACE FUNCTION public.finance_totals()
RETURNS TABLE (
  currency public.currency_code,
  student_payments numeric,
  other_income numeric,
  expenses numeric,
  teacher_payments numeric,
  worker_payments numeric,
  withdrawals numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH c AS (SELECT unnest(enum_range(NULL::public.currency_code)) AS currency),
       s AS (SELECT public.current_school_id() AS sid)
  SELECT
    c.currency,
    COALESCE((SELECT sum(x.amount) FROM public.student_payments x WHERE x.currency = c.currency AND x.school_id = (SELECT sid FROM s)), 0),
    COALESCE((SELECT sum(x.amount) FROM public.income_entries x WHERE x.currency = c.currency AND x.school_id = (SELECT sid FROM s)), 0),
    COALESCE((SELECT sum(x.amount) FROM public.expenses x WHERE x.currency = c.currency AND x.school_id = (SELECT sid FROM s)), 0),
    COALESCE((SELECT sum(x.amount) FROM public.teacher_payments x WHERE x.currency = c.currency AND x.school_id = (SELECT sid FROM s)), 0),
    COALESCE((SELECT sum(x.amount) FROM public.worker_payments x WHERE x.currency = c.currency AND x.school_id = (SELECT sid FROM s)), 0),
    COALESCE((SELECT sum(x.amount) FROM public.vault_withdrawals x WHERE x.currency = c.currency AND x.school_id = (SELECT sid FROM s)), 0)
  FROM c;
$$;

REVOKE ALL ON FUNCTION public.finance_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_totals() TO authenticated;