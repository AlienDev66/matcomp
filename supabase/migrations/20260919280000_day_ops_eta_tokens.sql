-- Day ops: weigh-in, pause mats, staff token expiry; realtime for entries

-- ─── Official weigh-in on entries ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.weigh_in_status AS ENUM ('pending', 'passed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.competition_entries
  ADD COLUMN IF NOT EXISTS weigh_in_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS weigh_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weigh_in_status public.weigh_in_status NOT NULL DEFAULT 'pending';

-- ─── Pause tatâmis on competition ────────────────────────────────────────────
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS paused_mats INT[] NOT NULL DEFAULT '{}';

-- ─── Staff token expiry ──────────────────────────────────────────────────────
ALTER TABLE public.event_staff
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

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
  WHERE s.token = _token
    AND s.active = true
    AND (s.expires_at IS NULL OR s.expires_at > now())
  LIMIT 1;
$$;

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
    JOIN public.event_staff s
      ON s.competition_id = m.competition_id
     AND s.active = true
     AND (s.expires_at IS NULL OR s.expires_at > now())
    WHERE m.id = _match_id
      AND s.token = _token
      AND (
        s.role = 'admin'
        OR s.role = 'referee'
        OR (s.role = 'mesa' AND (s.mat_number IS NULL OR s.mat_number = m.mat_number))
      )
  );
$$;

-- When competition finishes, expire all staff tokens immediately
CREATE OR REPLACE FUNCTION public.expire_staff_on_competition_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    UPDATE public.event_staff
    SET active = false,
        expires_at = COALESCE(expires_at, now())
    WHERE competition_id = NEW.id
      AND active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expire_staff_on_finish ON public.competitions;
CREATE TRIGGER trg_expire_staff_on_finish
  AFTER UPDATE OF status ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.expire_staff_on_competition_finish();

-- Realtime: entries (weigh-in). competitions/matches already published in core.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'competition_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_entries;
  END IF;
END $$;
