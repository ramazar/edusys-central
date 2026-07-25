
-- Tighten teacher_attendance SELECT
DROP POLICY IF EXISTS "Authenticated can view teacher attendance" ON public.teacher_attendance;
CREATE POLICY "Staff can view teacher attendance"
ON public.teacher_attendance FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[]));

-- Tighten teacher_section_assignments SELECT
DROP POLICY IF EXISTS read_assignments ON public.teacher_section_assignments;
CREATE POLICY "Staff or own can read assignments"
ON public.teacher_section_assignments FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception']::app_role[])
  OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
);

-- Revoke EXECUTE on SECURITY DEFINER trigger function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
