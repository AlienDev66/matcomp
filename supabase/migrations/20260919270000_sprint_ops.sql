-- Sprint ops: bracket formats, event staff tokens, federation approval, email outbox

-- ─── Bracket format on divisions ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.bracket_format AS ENUM (
    'single_elim',
    'double_elim',
    'round_robin',
    'single_elim_consolation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.competition_divisions
  ADD COLUMN IF NOT EXISTS bracket_format public.bracket_format NOT NULL DEFAULT 'single_elim';

DO $$ BEGIN
  CREATE TYPE public.bracket_side AS ENUM (
    'winners',
    'losers',
    'consolation',
    'rr',
    'grand_final'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS bracket_side public.bracket_side,
  ADD COLUMN IF NOT EXISTS is_bye BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loser_next_match_id UUID REFERENCES public.competition_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loser_next_slot TEXT CHECK (loser_next_slot IS NULL OR loser_next_slot IN ('a', 'b'));

-- ─── Federation approval on competitions ─────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.federation_approval AS ENUM (
    'none',
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS federation_approval public.federation_approval NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS public.federation_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  federation_id UUID NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (federation_id, user_id)
);

CREATE INDEX IF NOT EXISTS federation_admins_user_idx ON public.federation_admins (user_id);

ALTER TABLE public.federation_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read federation_admins" ON public.federation_admins;
CREATE POLICY "Public read federation_admins" ON public.federation_admins
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Managers insert federation_admins" ON public.federation_admins;
CREATE POLICY "Managers insert federation_admins" ON public.federation_admins
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'organizer'));

DROP POLICY IF EXISTS "Self delete federation_admins" ON public.federation_admins;
CREATE POLICY "Self delete federation_admins" ON public.federation_admins
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'organizer'));

CREATE OR REPLACE FUNCTION public.is_federation_admin(_federation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.federation_admins
    WHERE federation_id = _federation_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_federation_admin(UUID) TO authenticated, anon;

-- ─── Event staff / mesa tokens ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.event_staff_role AS ENUM ('mesa', 'referee', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.event_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role public.event_staff_role NOT NULL DEFAULT 'mesa',
  mat_number INT CHECK (mat_number IS NULL OR (mat_number >= 1 AND mat_number <= 24)),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_staff_comp_idx ON public.event_staff (competition_id);
CREATE INDEX IF NOT EXISTS event_staff_token_idx ON public.event_staff (token) WHERE active = true;

ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage event_staff" ON public.event_staff;
CREATE POLICY "Managers manage event_staff" ON public.event_staff
  FOR ALL TO authenticated
  USING (public.can_manage_competition(competition_id))
  WITH CHECK (public.can_manage_competition(competition_id));

DROP POLICY IF EXISTS "Public resolve event_staff token read" ON public.event_staff;
CREATE POLICY "Public resolve event_staff token read" ON public.event_staff
  FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE OR REPLACE FUNCTION public.resolve_mesa_token(_token TEXT)
RETURNS TABLE (
  staff_id UUID,
  competition_id UUID,
  role public.event_staff_role,
  mat_number INT,
  label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.competition_id, s.role, s.mat_number, s.label
  FROM public.event_staff s
  WHERE s.token = _token AND s.active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_mesa_token(TEXT) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.mesa_can_write_match(_match_id UUID, _token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.competition_matches m
    JOIN public.event_staff s ON s.competition_id = m.competition_id AND s.active = true
    WHERE m.id = _match_id
      AND s.token = _token
      AND (
        s.role = 'admin'
        OR s.role = 'referee'
        OR (s.role = 'mesa' AND (s.mat_number IS NULL OR s.mat_number = m.mat_number))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.mesa_can_write_match(UUID, TEXT) TO authenticated, anon;

-- Allow match updates when mesa token is valid (via request header trick won't work in PostgREST easily).
-- Instead expose RPCs for mesa scoring:
CREATE OR REPLACE FUNCTION public.mesa_update_match(
  _match_id UUID,
  _token TEXT,
  _patch JSONB
)
RETURNS public.competition_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.competition_matches;
BEGIN
  IF NOT public.mesa_can_write_match(_match_id, _token) THEN
    RAISE EXCEPTION 'Token mesa inválido para esta luta';
  END IF;

  UPDATE public.competition_matches m SET
    score_a = COALESCE((_patch->>'score_a')::INT, m.score_a),
    score_b = COALESCE((_patch->>'score_b')::INT, m.score_b),
    advantages_a = COALESCE((_patch->>'advantages_a')::INT, m.advantages_a),
    advantages_b = COALESCE((_patch->>'advantages_b')::INT, m.advantages_b),
    penalties_a = COALESCE((_patch->>'penalties_a')::INT, m.penalties_a),
    penalties_b = COALESCE((_patch->>'penalties_b')::INT, m.penalties_b),
    clock_seconds = COALESCE((_patch->>'clock_seconds')::INT, m.clock_seconds),
    clock_running = COALESCE((_patch->>'clock_running')::BOOLEAN, m.clock_running),
    clock_updated_at = CASE
      WHEN _patch ? 'clock_running' OR _patch ? 'clock_seconds'
        THEN now()
      ELSE m.clock_updated_at
    END,
    status = COALESCE((_patch->>'status')::public.match_status, m.status),
    sides_swapped = COALESCE((_patch->>'sides_swapped')::BOOLEAN, m.sides_swapped)
  WHERE m.id = _match_id
  RETURNING * INTO row;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mesa_update_match(UUID, TEXT, JSONB) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.mesa_set_winner(
  _match_id UUID,
  _token TEXT,
  _winner_id UUID,
  _win_method TEXT DEFAULT 'points'
)
RETURNS public.competition_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.competition_matches;
  loser_id UUID;
BEGIN
  IF NOT public.mesa_can_write_match(_match_id, _token) THEN
    RAISE EXCEPTION 'Token mesa inválido para esta luta';
  END IF;

  SELECT * INTO m FROM public.competition_matches WHERE id = _match_id;
  IF m IS NULL THEN RAISE EXCEPTION 'Luta não encontrada'; END IF;

  UPDATE public.competition_matches SET
    status = 'finished',
    winner_id = _winner_id,
    win_method = _win_method,
    clock_running = false,
    is_bye = false
  WHERE id = _match_id
  RETURNING * INTO m;

  IF m.next_match_id IS NOT NULL AND m.next_slot IS NOT NULL THEN
    IF m.next_slot = 'a' THEN
      UPDATE public.competition_matches SET athlete_a_id = _winner_id WHERE id = m.next_match_id;
    ELSE
      UPDATE public.competition_matches SET athlete_b_id = _winner_id WHERE id = m.next_match_id;
    END IF;
  END IF;

  -- Loser advances in double-elim / consolation
  IF m.athlete_a_id = _winner_id THEN
    loser_id := m.athlete_b_id;
  ELSE
    loser_id := m.athlete_a_id;
  END IF;

  IF loser_id IS NOT NULL AND m.loser_next_match_id IS NOT NULL AND m.loser_next_slot IS NOT NULL THEN
    IF m.loser_next_slot = 'a' THEN
      UPDATE public.competition_matches SET athlete_a_id = loser_id WHERE id = m.loser_next_match_id;
    ELSE
      UPDATE public.competition_matches SET athlete_b_id = loser_id WHERE id = m.loser_next_match_id;
    END IF;
  END IF;

  RETURN m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mesa_set_winner(UUID, TEXT, UUID, TEXT) TO authenticated, anon;

-- ─── Email outbox ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_outbox_comp_idx ON public.email_outbox (competition_id);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read email_outbox" ON public.email_outbox;
CREATE POLICY "Managers read email_outbox" ON public.email_outbox
  FOR SELECT TO authenticated
  USING (
    competition_id IS NULL
    OR public.can_manage_competition(competition_id)
  );

-- Inserts via service role / security definer only in app; allow managers to insert for their events
DROP POLICY IF EXISTS "Managers insert email_outbox" ON public.email_outbox;
CREATE POLICY "Managers insert email_outbox" ON public.email_outbox
  FOR INSERT TO authenticated
  WITH CHECK (
    competition_id IS NULL
    OR public.can_manage_competition(competition_id)
  );
