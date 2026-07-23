
-- Fix: restrict profile reads to self and admins
DROP POLICY IF EXISTS authenticated_read_profiles ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- Fix: revoke EXECUTE on trigger-only SECURITY DEFINER functions from signed-in users
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
