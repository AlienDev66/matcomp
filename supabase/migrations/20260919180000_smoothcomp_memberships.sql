-- MatComp — Smoothcomp-style memberships + user-owned events

CREATE TYPE public.join_request_status AS ENUM ('pending', 'accepted', 'rejected');

-- ─── Academies: approval flag ────────────────────────────────────────────────
ALTER TABLE public.academies
  ADD COLUMN IF NOT EXISTS require_member_approval BOOLEAN NOT NULL DEFAULT true;

-- ─── Athletes linked to auth users ───────────────────────────────────────────
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS athletes_user_id_unique
  ON public.athletes (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS athletes_user_idx ON public.athletes (user_id)
  WHERE user_id IS NOT NULL;

-- ─── Join requests ───────────────────────────────────────────────────────────
CREATE TABLE public.academy_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  status public.join_request_status NOT NULL DEFAULT 'pending',
  message TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX academy_join_requests_active_unique
  ON public.academy_join_requests (user_id, academy_id)
  WHERE status IN ('pending', 'accepted');

CREATE INDEX academy_join_requests_academy_idx
  ON public.academy_join_requests (academy_id, status);

CREATE INDEX academy_join_requests_user_idx
  ON public.academy_join_requests (user_id);

CREATE TRIGGER academy_join_requests_touch
  BEFORE UPDATE ON public.academy_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── Competitions: creator + nullable host academy ───────────────────────────
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill created_by from academy owner
UPDATE public.competitions c
SET created_by = m.user_id
FROM public.academy_members m
WHERE c.created_by IS NULL
  AND m.academy_id = c.academy_id
  AND m.role = 'owner';

-- Fallback: any staff member
UPDATE public.competitions c
SET created_by = m.user_id
FROM public.academy_members m
WHERE c.created_by IS NULL
  AND m.academy_id = c.academy_id;

ALTER TABLE public.competitions
  ALTER COLUMN academy_id DROP NOT NULL;

-- Drop old unique (academy_id, slug); allow user-owned events with global slug uniqueness per creator
ALTER TABLE public.competitions DROP CONSTRAINT IF EXISTS competitions_academy_id_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS competitions_created_by_slug_unique
  ON public.competitions (created_by, slug)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS competitions_created_by_idx ON public.competitions (created_by);

-- ─── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_competition(_competition_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = _competition_id
      AND (
        c.created_by = auth.uid()
        OR (c.academy_id IS NOT NULL AND public.is_academy_member(c.academy_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_academy_athlete(_academy_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.academy_id = _academy_id
      AND a.user_id = auth.uid()
      AND a.active = true
  );
$$;

-- Soften signup: still create organizer role for backwards compat, also allow athlete capability via memberships
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'organizer')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── Accept / reject RPCs ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_academy_join_request(_request_id UUID)
RETURNS public.athletes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.academy_join_requests%ROWTYPE;
  ath public.athletes%ROWTYPE;
  pname TEXT;
BEGIN
  SELECT * INTO req FROM public.academy_join_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Pedido já foi processado';
  END IF;
  IF NOT public.is_academy_member(req.academy_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT full_name INTO pname FROM public.profiles WHERE user_id = req.user_id;
  IF pname IS NULL OR TRIM(pname) = '' THEN
    pname := 'Atleta';
  END IF;

  UPDATE public.academy_join_requests
  SET status = 'accepted',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _request_id;

  SELECT * INTO ath FROM public.athletes
  WHERE user_id = req.user_id AND academy_id = req.academy_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.athletes
    SET active = true, full_name = COALESCE(NULLIF(TRIM(full_name), ''), pname)
    WHERE id = ath.id
    RETURNING * INTO ath;
  ELSE
    -- If user already linked to another athlete row uniquely, reuse/update that row's academy? Unique on user_id — one athlete identity.
    SELECT * INTO ath FROM public.athletes WHERE user_id = req.user_id LIMIT 1;
    IF FOUND THEN
      UPDATE public.athletes
      SET academy_id = req.academy_id,
          active = true,
          full_name = COALESCE(NULLIF(TRIM(full_name), ''), pname)
      WHERE id = ath.id
      RETURNING * INTO ath;
    ELSE
      INSERT INTO public.athletes (academy_id, user_id, full_name, belt, category, active)
      VALUES (req.academy_id, req.user_id, pname, 'white', 'adult', true)
      RETURNING * INTO ath;
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (req.user_id, 'athlete')
  ON CONFLICT DO NOTHING;

  RETURN ath;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_academy_join_request(_request_id UUID)
RETURNS public.academy_join_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.academy_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM public.academy_join_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Pedido já foi processado';
  END IF;
  IF NOT public.is_academy_member(req.academy_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.academy_join_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _request_id
  RETURNING * INTO req;

  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_join_academy(_academy_id UUID, _message TEXT DEFAULT NULL)
RETURNS public.academy_join_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.academy_join_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Precisas de sessão';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.academies WHERE id = _academy_id) THEN
    RAISE EXCEPTION 'Academia não encontrada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.athletes
    WHERE user_id = auth.uid() AND academy_id = _academy_id AND active = true
  ) THEN
    RAISE EXCEPTION 'Já estás associado a esta academia';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.academy_join_requests
    WHERE user_id = auth.uid() AND academy_id = _academy_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Já tens um pedido pendente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.academy_join_requests
    WHERE user_id = auth.uid() AND academy_id = _academy_id AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Já foste aceite nesta academia';
  END IF;

  -- Re-open a previous rejection
  UPDATE public.academy_join_requests
  SET status = 'pending',
      message = NULLIF(TRIM(_message), ''),
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now()
  WHERE user_id = auth.uid()
    AND academy_id = _academy_id
    AND status = 'rejected'
  RETURNING * INTO req;

  IF FOUND THEN
    RETURN req;
  END IF;

  INSERT INTO public.academy_join_requests (user_id, academy_id, status, message)
  VALUES (auth.uid(), _academy_id, 'pending', NULLIF(TRIM(_message), ''))
  RETURNING * INTO req;

  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_academy_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_academy_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_academy(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_competition(UUID) TO authenticated, anon;

-- ─── RLS: join requests ──────────────────────────────────────────────────────
ALTER TABLE public.academy_join_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.academy_join_requests TO authenticated;
GRANT SELECT ON public.academy_join_requests TO anon;

CREATE POLICY "Users read own join requests" ON public.academy_join_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_academy_member(academy_id));

CREATE POLICY "Users create own join requests" ON public.academy_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Users cancel own pending requests" ON public.academy_join_requests
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Staff update join requests" ON public.academy_join_requests
  FOR UPDATE TO authenticated
  USING (public.is_academy_member(academy_id))
  WITH CHECK (public.is_academy_member(academy_id));

-- ─── RLS: competitions (replace staff-only manage) ───────────────────────────
DROP POLICY IF EXISTS "Staff manage competitions" ON public.competitions;

CREATE POLICY "Creator or staff manage competitions" ON public.competitions
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR (academy_id IS NOT NULL AND public.is_academy_member(academy_id))
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (academy_id IS NOT NULL AND public.is_academy_member(academy_id))
  );

CREATE POLICY "Authenticated create competitions" ON public.competitions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Divisions / matches: creator or host staff
DROP POLICY IF EXISTS "Staff manage divisions" ON public.competition_divisions;
CREATE POLICY "Managers manage divisions" ON public.competition_divisions
  FOR ALL TO authenticated
  USING (public.can_manage_competition(competition_id))
  WITH CHECK (public.can_manage_competition(competition_id));

DROP POLICY IF EXISTS "Staff manage matches" ON public.competition_matches;
CREATE POLICY "Managers manage matches" ON public.competition_matches
  FOR ALL TO authenticated
  USING (public.can_manage_competition(competition_id))
  WITH CHECK (public.can_manage_competition(competition_id));

-- Entries: staff/creator manage; athlete self-register when competition is open
DROP POLICY IF EXISTS "Staff manage entries" ON public.competition_entries;

CREATE POLICY "Managers manage entries" ON public.competition_entries
  FOR ALL TO authenticated
  USING (public.can_manage_competition(competition_id))
  WITH CHECK (public.can_manage_competition(competition_id));

CREATE POLICY "Athletes self-register entries" ON public.competition_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id
        AND c.status = 'registration'
    )
    AND EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = athlete_id
        AND a.user_id = auth.uid()
        AND a.active = true
    )
  );

CREATE POLICY "Athletes read own entries" ON public.competition_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = athlete_id AND a.user_id = auth.uid()
    )
  );

-- Athletes: linked user can update own row (belt/weight later); staff still manage
CREATE POLICY "Athletes update own profile row" ON public.athletes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Staff can see names of people requesting to join their academy
CREATE POLICY "Staff read join requester profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.academy_join_requests r
      WHERE r.user_id = profiles.user_id
        AND public.is_academy_member(r.academy_id)
    )
  );
