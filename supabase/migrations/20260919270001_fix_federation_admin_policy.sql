-- Hotfix: app_role só tem 'organizer' | 'athlete' (não 'admin').
-- Corre isto no SQL Editor se a migration 20260919270000 falhou a meio.

DROP POLICY IF EXISTS "Managers insert federation_admins" ON public.federation_admins;
CREATE POLICY "Managers insert federation_admins" ON public.federation_admins
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'organizer'));

DROP POLICY IF EXISTS "Self delete federation_admins" ON public.federation_admins;
CREATE POLICY "Self delete federation_admins" ON public.federation_admins
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'organizer'));
