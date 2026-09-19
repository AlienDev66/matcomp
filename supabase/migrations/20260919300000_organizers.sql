-- Organizer entity (Smoothcomp-style): ownership of events, federation link via code

DO $$ BEGIN
  CREATE TYPE public.organizer_member_role AS ENUM ('owner', 'admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  organization_code TEXT NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  contact_email TEXT,
  billing_email TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizers_created_by_idx ON public.organizers (created_by);
CREATE INDEX IF NOT EXISTS organizers_code_idx ON public.organizers (organization_code);

CREATE TABLE IF NOT EXISTS public.organizer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.organizer_member_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organizer_id, user_id)
);

CREATE INDEX IF NOT EXISTS organizer_members_user_idx ON public.organizer_members (user_id);

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.organizers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS competitions_organizer_idx ON public.competitions (organizer_id);

CREATE UNIQUE INDEX IF NOT EXISTS competitions_organizer_slug_unique
  ON public.competitions (organizer_id, slug)
  WHERE organizer_id IS NOT NULL;

-- Federation ↔ organizer connection (Smoothcomp "organization code")
CREATE TABLE IF NOT EXISTS public.federation_organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  federation_id UUID NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (federation_id, organizer_id)
);

CREATE INDEX IF NOT EXISTS federation_organizers_fed_idx ON public.federation_organizers (federation_id);
CREATE INDEX IF NOT EXISTS federation_organizers_org_idx ON public.federation_organizers (organizer_id);

ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_organizers ENABLE ROW LEVEL SECURITY;

-- Helpers first (SECURITY DEFINER) — policies must not SELECT organizer_members directly.
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

DROP POLICY IF EXISTS "Public read organizers" ON public.organizers;
CREATE POLICY "Public read organizers" ON public.organizers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Members insert organizers" ON public.organizers;
CREATE POLICY "Members insert organizers" ON public.organizers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners update organizers" ON public.organizers;
CREATE POLICY "Owners update organizers" ON public.organizers
  FOR UPDATE TO authenticated
  USING (public.can_manage_organizer(id) OR public.is_organizer_creator(id));

DROP POLICY IF EXISTS "Public read organizer_members" ON public.organizer_members;
CREATE POLICY "Public read organizer_members" ON public.organizer_members
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Owners manage organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Self insert first organizer_member" ON public.organizer_members;
DROP POLICY IF EXISTS "Insert organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Update organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Delete organizer_members" ON public.organizer_members;
DROP POLICY IF EXISTS "Read organizer_members" ON public.organizer_members;

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

DROP POLICY IF EXISTS "Public read federation_organizers" ON public.federation_organizers;
CREATE POLICY "Public read federation_organizers" ON public.federation_organizers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Fed admins manage federation_organizers" ON public.federation_organizers;
CREATE POLICY "Fed admins manage federation_organizers" ON public.federation_organizers
  FOR ALL TO authenticated
  USING (public.is_federation_admin(federation_id))
  WITH CHECK (public.is_federation_admin(federation_id));

DROP POLICY IF EXISTS "Org admins request federation_organizers" ON public.federation_organizers;
CREATE POLICY "Org admins request federation_organizers" ON public.federation_organizers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_organizer(organizer_id));

-- Competitions: manage via organizer membership OR legacy created_by / academy staff
CREATE OR REPLACE FUNCTION public.can_manage_competition(_competition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = _competition_id
      AND (
        c.created_by = auth.uid()
        OR (c.academy_id IS NOT NULL AND public.is_academy_member(c.academy_id))
        OR (c.organizer_id IS NOT NULL AND public.is_organizer_member(c.organizer_id))
      )
  );
$$;

-- Connect organizer to federation by organization code
CREATE OR REPLACE FUNCTION public.connect_organizer_by_code(
  _federation_id UUID,
  _organization_code TEXT
)
RETURNS public.federation_organizers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org public.organizers;
  row public.federation_organizers;
BEGIN
  IF NOT public.is_federation_admin(_federation_id) THEN
    RAISE EXCEPTION 'Sem permissão de admin da federação';
  END IF;

  SELECT * INTO org
  FROM public.organizers
  WHERE organization_code = lower(trim(_organization_code))
  LIMIT 1;

  IF org IS NULL THEN
    RAISE EXCEPTION 'Código de organização inválido';
  END IF;

  INSERT INTO public.federation_organizers (federation_id, organizer_id, approved)
  VALUES (_federation_id, org.id, true)
  ON CONFLICT (federation_id, organizer_id) DO UPDATE
    SET approved = true
  RETURNING * INTO row;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_organizer_by_code(UUID, TEXT) TO authenticated;

-- Backfill: one personal organizer per user who already created events
INSERT INTO public.organizers (name, slug, created_by, contact_email)
SELECT DISTINCT ON (c.created_by)
  COALESCE(NULLIF(TRIM(p.full_name), ''), split_part(COALESCE(p.email, 'organizador'), '@', 1)) || ' Events',
  lower(substr(replace(c.created_by::text, '-', ''), 1, 12)) || '-org',
  c.created_by,
  p.email
FROM public.competitions c
LEFT JOIN public.profiles p ON p.user_id = c.created_by
WHERE c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organizers o WHERE o.created_by = c.created_by
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organizer_members (organizer_id, user_id, role)
SELECT o.id, o.created_by, 'owner'
FROM public.organizers o
WHERE o.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organizer_members m
    WHERE m.organizer_id = o.id AND m.user_id = o.created_by
  );

UPDATE public.competitions c
SET organizer_id = o.id
FROM public.organizers o
WHERE c.organizer_id IS NULL
  AND c.created_by IS NOT NULL
  AND o.created_by = c.created_by;
