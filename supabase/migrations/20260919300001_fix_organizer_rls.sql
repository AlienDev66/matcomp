-- Fix infinite recursion in organizer_members RLS policies.
-- Policies must NOT SELECT organizer_members directly; use SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.is_organizer_member(_organizer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizer_members
    WHERE organizer_id = _organizer_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_organizer(_organizer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizer_members
    WHERE organizer_id = _organizer_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organizer_creator(_organizer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizers
    WHERE id = _organizer_id AND created_by = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_organizer_member(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_organizer(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_organizer_creator(UUID) TO authenticated, anon;

DROP POLICY IF EXISTS "Owners update organizers" ON public.organizers;
CREATE POLICY "Owners update organizers" ON public.organizers
  FOR UPDATE TO authenticated
  USING (public.can_manage_organizer(id) OR public.is_organizer_creator(id));

DROP POLICY IF EXISTS "Public read organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Owners manage organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Self insert first organizer_member" ON public.organizer_members;
DROP POLICY IF EXISTS "Insert organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Update organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Delete organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Read organizer_members" ON public.organizer_members;

CREATE POLICY "Public read organizer_members" ON public.organizer_members
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Insert organizer_members" ON public.organizer_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_organizer_creator(organizer_id)
      OR public.can_manage_organizer(organizer_id)
    )
  );

CREATE POLICY "Update organizer_members" ON public.organizer_members
  FOR UPDATE TO authenticated
  USING (public.can_manage_organizer(organizer_id))
  WITH CHECK (public.can_manage_organizer(organizer_id));

CREATE POLICY "Delete organizer_members" ON public.organizer_members
  FOR DELETE TO authenticated
  USING (
    public.can_manage_organizer(organizer_id)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Org admins request federation_organizers" ON public.federation_organizers;
CREATE POLICY "Org admins request federation_organizers" ON public.federation_organizers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_organizer(organizer_id));
