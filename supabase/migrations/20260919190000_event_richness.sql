-- MatComp — Smoothcomp event richness (cover, prices, deadlines, etc.)

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS livestream_url TEXT,
  ADD COLUMN IF NOT EXISTS refund_policy_url TEXT,
  ADD COLUMN IF NOT EXISTS map_query TEXT,
  ADD COLUMN IF NOT EXISTS info_pt TEXT,
  ADD COLUMN IF NOT EXISTS info_en TEXT,
  ADD COLUMN IF NOT EXISTS info_es TEXT,
  ADD COLUMN IF NOT EXISTS deadline_early_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deadline_refund_100_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deadline_edit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS organizer_years INT,
  ADD COLUMN IF NOT EXISTS organizer_events_count INT;

ALTER TABLE public.competition_divisions
  ADD COLUMN IF NOT EXISTS price_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS affiliation TEXT;

ALTER TABLE public.academies
  ADD COLUMN IF NOT EXISTS affiliation TEXT;

ALTER TABLE public.competition_entries
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS estimated_start TIMESTAMPTZ;

-- Favorites
CREATE TABLE IF NOT EXISTS public.competition_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, competition_id)
);

CREATE INDEX IF NOT EXISTS competition_favorites_user_idx
  ON public.competition_favorites (user_id);

ALTER TABLE public.competition_favorites ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.competition_favorites TO authenticated;
GRANT SELECT ON public.competition_favorites TO anon;

DROP POLICY IF EXISTS "Users manage own favorites" ON public.competition_favorites;
CREATE POLICY "Users manage own favorites" ON public.competition_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Public read favorites count" ON public.competition_favorites;
CREATE POLICY "Public read favorites count" ON public.competition_favorites
  FOR SELECT USING (true);
