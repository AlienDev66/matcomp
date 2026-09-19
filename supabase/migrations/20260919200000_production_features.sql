-- Sprint B–F production foundations

-- Entries payment
ALTER TABLE public.competition_entries
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid_cents INT,
  ADD COLUMN IF NOT EXISTS check_in_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- Cover storage note: create bucket "event-covers" in Supabase dashboard (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read event covers" ON storage.objects;
CREATE POLICY "Public read event covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-covers');

DROP POLICY IF EXISTS "Auth upload event covers" ON storage.objects;
CREATE POLICY "Auth upload event covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-covers');

DROP POLICY IF EXISTS "Auth update event covers" ON storage.objects;
CREATE POLICY "Auth update event covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'event-covers');


-- Rankings
CREATE TABLE IF NOT EXISTS public.ranking_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_label TEXT NOT NULL DEFAULT 'Adult - GI',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ranking_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.ranking_seasons(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  points NUMERIC(10,2) NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  gold INT NOT NULL DEFAULT 0,
  silver INT NOT NULL DEFAULT 0,
  bronze INT NOT NULL DEFAULT 0,
  rank INT,
  UNIQUE (season_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS ranking_rows_season_idx ON public.ranking_rows (season_id, points DESC);

ALTER TABLE public.ranking_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_rows ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ranking_seasons TO authenticated;
GRANT SELECT ON public.ranking_seasons TO anon;
GRANT ALL ON public.ranking_rows TO authenticated;
GRANT SELECT ON public.ranking_rows TO anon;

DROP POLICY IF EXISTS "Public read ranking seasons" ON public.ranking_seasons;
CREATE POLICY "Public read ranking seasons" ON public.ranking_seasons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage ranking seasons" ON public.ranking_seasons;
CREATE POLICY "Auth manage ranking seasons" ON public.ranking_seasons FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read ranking rows" ON public.ranking_rows;
CREATE POLICY "Public read ranking rows" ON public.ranking_rows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage ranking rows" ON public.ranking_rows;
CREATE POLICY "Auth manage ranking rows" ON public.ranking_rows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Federations
CREATE TABLE IF NOT EXISTS public.federations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subdomain TEXT UNIQUE,
  logo_url TEXT,
  banner_url TEXT,
  website_url TEXT,
  primary_color TEXT DEFAULT '#e11d48',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS federation_id UUID REFERENCES public.federations(id) ON DELETE SET NULL;

ALTER TABLE public.federations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.federations TO authenticated;
GRANT SELECT ON public.federations TO anon;

DROP POLICY IF EXISTS "Public read federations" ON public.federations;
CREATE POLICY "Public read federations" ON public.federations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage federations" ON public.federations;
CREATE POLICY "Auth manage federations" ON public.federations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default season
INSERT INTO public.ranking_seasons (name, slug, category_label)
VALUES ('Season 2026', '2026', 'Adult - GI')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.federations (name, slug, subdomain, website_url)
VALUES ('MatComp Open', 'matcomp', 'matcomp', 'https://matcomp.app')
ON CONFLICT (slug) DO NOTHING;

-- Generate check-in codes for existing entries
UPDATE public.competition_entries
SET check_in_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
WHERE check_in_code IS NULL;

-- Athletes can update their own entry payment / check-in fields
DROP POLICY IF EXISTS "Athletes update own entries" ON public.competition_entries;
CREATE POLICY "Athletes update own entries" ON public.competition_entries
  FOR UPDATE TO authenticated
  USING (
    athlete_id IN (SELECT id FROM public.athletes WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id
        AND (c.created_by = auth.uid() OR public.is_academy_member(c.academy_id))
    )
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM public.athletes WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id
        AND (c.created_by = auth.uid() OR public.is_academy_member(c.academy_id))
    )
  );

-- Staff check-in by code (any authenticated user with code)
DROP POLICY IF EXISTS "Auth check-in by code" ON public.competition_entries;
CREATE POLICY "Auth check-in by code" ON public.competition_entries
  FOR UPDATE TO authenticated
  USING (check_in_code IS NOT NULL)
  WITH CHECK (true);
