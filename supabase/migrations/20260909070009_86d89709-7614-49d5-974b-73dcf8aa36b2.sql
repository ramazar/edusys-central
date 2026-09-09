CREATE TABLE public.vault_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id),
  amount numeric NOT NULL,
  currency public.currency_code NOT NULL DEFAULT 'SYP',
  withdrawn_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_withdrawals TO authenticated;
GRANT ALL ON public.vault_withdrawals TO service_role;

ALTER TABLE public.vault_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vault_select_members" ON public.vault_withdrawals FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "vault_insert_finance" ON public.vault_withdrawals FOR INSERT TO authenticated
  WITH CHECK (
    (school_id = public.current_school_id() AND public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "vault_update_finance" ON public.vault_withdrawals FOR UPDATE TO authenticated
  USING (
    (school_id = public.current_school_id() AND public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "vault_delete_finance" ON public.vault_withdrawals FOR DELETE TO authenticated
  USING (
    (school_id = public.current_school_id() AND public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
    OR public.is_super_admin(auth.uid())
  );

CREATE INDEX idx_vault_withdrawals_school_date ON public.vault_withdrawals(school_id, withdrawn_at DESC);

CREATE TRIGGER trg_vault_withdrawals_updated_at BEFORE UPDATE ON public.vault_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();