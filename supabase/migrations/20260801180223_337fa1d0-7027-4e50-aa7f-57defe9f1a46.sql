-- grades / sections: require an assigned staff role
DROP POLICY IF EXISTS read_grades ON public.grades;
CREATE POLICY read_grades ON public.grades FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception','teacher']::app_role[]));

DROP POLICY IF EXISTS read_sections ON public.sections;
CREATE POLICY read_sections ON public.sections FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','reception','teacher']::app_role[]));

-- teacher pay data: admin/accountant, or the teacher themselves
DROP POLICY IF EXISTS "auth read lecture types" ON public.teacher_lecture_types;
CREATE POLICY "read lecture types" ON public.teacher_lecture_types FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[])
  OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_lecture_types.teacher_id AND t.user_id = auth.uid())
);

DROP POLICY IF EXISTS "auth read lectures" ON public.teacher_lectures;
CREATE POLICY "read lectures" ON public.teacher_lectures FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[])
  OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_lectures.teacher_id AND t.user_id = auth.uid())
);

-- notifications: controlled creation path (admins only)
CREATE POLICY admin_insert_notifications ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- user_roles: explicit admin-only management, no self-escalation
CREATE POLICY admin_insert_roles ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY admin_update_roles ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY admin_delete_roles ON public.user_roles FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));