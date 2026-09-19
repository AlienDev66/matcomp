-- Day stations: weigh-in / caller / podium staff + match call state + podium queue

-- ─── Extend staff roles ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'event_staff_role' AND e.enumlabel = 'weigh_in'
  ) THEN
    ALTER TYPE public.event_staff_role ADD VALUE 'weigh_in';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'event_staff_role' AND e.enumlabel = 'caller'
  ) THEN
    ALTER TYPE public.event_staff_role ADD VALUE 'caller';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'event_staff_role' AND e.enumlabel = 'podium'
  ) THEN
    ALTER TYPE public.event_staff_role ADD VALUE 'podium';
  END IF;
END $$;

-- ─── Call status per side of a match ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.athlete_call_status AS ENUM (
    'none',
    'warmup',
    'mat',
    'holding',
    'done'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS call_a public.athlete_call_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS call_b public.athlete_call_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS call_a_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_b_at TIMESTAMPTZ;

-- ─── Podium queue ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.podium_medal AS ENUM ('gold', 'silver', 'bronze');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.podium_call_status AS ENUM ('pending', 'called', 'done', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.podium_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.competition_divisions(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  medal public.podium_medal NOT NULL,
  status public.podium_call_status NOT NULL DEFAULT 'pending',
  called_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competition_id, division_id, athlete_id, medal)
);

CREATE INDEX IF NOT EXISTS podium_calls_comp_idx
  ON public.podium_calls (competition_id, status, created_at);

ALTER TABLE public.podium_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read podium_calls" ON public.podium_calls;
CREATE POLICY "Public read podium_calls" ON public.podium_calls
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Managers manage podium_calls" ON public.podium_calls;
CREATE POLICY "Managers manage podium_calls" ON public.podium_calls
  FOR ALL TO authenticated
  USING (public.can_manage_competition(competition_id))
  WITH CHECK (public.can_manage_competition(competition_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'podium_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.podium_calls;
  END IF;
END $$;

-- ─── Staff role helper ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_has_role(
  _token TEXT,
  _competition_id UUID,
  _roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_staff s
    WHERE s.token = _token
      AND s.competition_id = _competition_id
      AND s.active = true
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND (
        s.role::text = ANY (_roles)
        OR s.role::text = 'admin'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.staff_has_role(TEXT, UUID, TEXT[]) TO authenticated, anon;

-- ─── Staff: weigh-in ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_record_weigh_in(
  _entry_id UUID,
  _token TEXT,
  _kg NUMERIC,
  _status public.weigh_in_status
)
RETURNS public.competition_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.competition_entries;
BEGIN
  SELECT * INTO e FROM public.competition_entries WHERE id = _entry_id;
  IF e IS NULL THEN RAISE EXCEPTION 'Inscrição não encontrada'; END IF;

  IF NOT public.staff_has_role(
    _token,
    e.competition_id,
    ARRAY['weigh_in', 'caller', 'admin']
  ) THEN
    RAISE EXCEPTION 'Token inválido para pesagem';
  END IF;

  UPDATE public.competition_entries SET
    weigh_in_kg = _kg,
    weigh_in_status = _status,
    weigh_in_at = now()
  WHERE id = _entry_id
  RETURNING * INTO e;

  RETURN e;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_record_weigh_in(UUID, TEXT, NUMERIC, public.weigh_in_status)
  TO authenticated, anon;

-- ─── Staff: set call status on a match side ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_set_match_call(
  _match_id UUID,
  _token TEXT,
  _side TEXT,
  _status public.athlete_call_status
)
RETURNS public.competition_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.competition_matches;
BEGIN
  IF _side NOT IN ('a', 'b') THEN
    RAISE EXCEPTION 'Side inválido';
  END IF;

  SELECT * INTO m FROM public.competition_matches WHERE id = _match_id;
  IF m IS NULL THEN RAISE EXCEPTION 'Luta não encontrada'; END IF;

  IF NOT public.staff_has_role(
    _token,
    m.competition_id,
    ARRAY['caller', 'mesa', 'referee', 'admin']
  ) THEN
    RAISE EXCEPTION 'Token inválido para chamada';
  END IF;

  IF _side = 'a' THEN
    UPDATE public.competition_matches SET
      call_a = _status,
      call_a_at = now()
    WHERE id = _match_id
    RETURNING * INTO m;
  ELSE
    UPDATE public.competition_matches SET
      call_b = _status,
      call_b_at = now()
    WHERE id = _match_id
    RETURNING * INTO m;
  END IF;

  RETURN m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_set_match_call(UUID, TEXT, TEXT, public.athlete_call_status)
  TO authenticated, anon;

-- ─── Staff: podium call status ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_set_podium_status(
  _podium_id UUID,
  _token TEXT,
  _status public.podium_call_status
)
RETURNS public.podium_calls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.podium_calls;
BEGIN
  SELECT * INTO p FROM public.podium_calls WHERE id = _podium_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Chamada de pódio não encontrada'; END IF;

  IF NOT public.staff_has_role(
    _token,
    p.competition_id,
    ARRAY['podium', 'admin']
  ) THEN
    RAISE EXCEPTION 'Token inválido para pódio';
  END IF;

  UPDATE public.podium_calls SET
    status = _status,
    called_at = CASE WHEN _status = 'called' THEN now() ELSE called_at END,
    done_at = CASE WHEN _status IN ('done', 'skipped') THEN now() ELSE done_at END
  WHERE id = _podium_id
  RETURNING * INTO p;

  RETURN p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_set_podium_status(UUID, TEXT, public.podium_call_status)
  TO authenticated, anon;

-- Allow managers to update call columns via normal match update path (already covered)
-- Extend mesa_update_match to accept call_a / call_b
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
    sides_swapped = COALESCE((_patch->>'sides_swapped')::BOOLEAN, m.sides_swapped),
    call_a = COALESCE((_patch->>'call_a')::public.athlete_call_status, m.call_a),
    call_b = COALESCE((_patch->>'call_b')::public.athlete_call_status, m.call_b),
    call_a_at = CASE WHEN _patch ? 'call_a' THEN now() ELSE m.call_a_at END,
    call_b_at = CASE WHEN _patch ? 'call_b' THEN now() ELSE m.call_b_at END
  WHERE m.id = _match_id
  RETURNING * INTO row;

  RETURN row;
END;
$$;
