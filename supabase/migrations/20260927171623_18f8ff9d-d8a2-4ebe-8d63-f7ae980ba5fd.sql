-- Teachers may delete academic harvest records, not only admins.
DROP POLICY IF EXISTS "admin_delete_harvest" ON public.academic_harvest;
DROP POLICY IF EXISTS "staff_delete_harvest" ON public.academic_harvest;
CREATE POLICY "staff_delete_harvest" ON public.academic_harvest
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','teacher']::app_role[]));
