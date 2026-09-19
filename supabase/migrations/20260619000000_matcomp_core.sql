-- MatComp — multi-academy competition platform (Smoothcomp-style)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Roles ───────────────────────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('organizer', 'athlete');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'staff');
CREATE TYPE public.competition_status AS ENUM ('draft', 'registration', 'live', 'finished');
CREATE TYPE public.match_status AS ENUM ('queued', 'live', 'finished', 'cancelled');
CREATE TYPE public.athlete_category AS ENUM ('adult', 'child');
CREATE TYPE public.bjj_belt AS ENUM (
  'white', 'blue', 'purple', 'brown', 'black',
  'grey', 'yellow', 'orange', 'green'
);

-- ─── Profiles (platform user) ────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'organizer',
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Academies (tenants) ─────────────────────────────────────────────────────
CREATE TABLE public.academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT,
  country TEXT DEFAULT 'PT',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#e11d48',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.academy_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academy_id, user_id)
);

CREATE INDEX academy_members_user_idx ON public.academy_members (user_id);

CREATE OR REPLACE FUNCTION public.is_academy_member(_academy_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_members
    WHERE academy_id = _academy_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_academy_admin(_academy_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_members
    WHERE academy_id = _academy_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- ─── Athletes (roster per academy) ───────────────────────────────────────────
CREATE TABLE public.athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  belt public.bjj_belt DEFAULT 'white',
  belt_degrees SMALLINT NOT NULL DEFAULT 0 CHECK (belt_degrees BETWEEN 0 AND 4),
  category public.athlete_category NOT NULL DEFAULT 'adult',
  weight_kg NUMERIC(5,2),
  birth_date DATE,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX athletes_academy_idx ON public.athletes (academy_id);

-- ─── Competitions ────────────────────────────────────────────────────────────
CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status public.competition_status NOT NULL DEFAULT 'draft',
  venue TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academy_id, slug)
);

CREATE INDEX competitions_academy_idx ON public.competitions (academy_id);

CREATE TABLE public.competition_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  belt public.bjj_belt,
  category public.athlete_category,
  weight_min_kg NUMERIC(5,2),
  weight_max_kg NUMERIC(5,2),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.competition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  division_id UUID REFERENCES public.competition_divisions(id) ON DELETE SET NULL,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  seed INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competition_id, athlete_id)
);

CREATE TABLE public.competition_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  division_id UUID REFERENCES public.competition_divisions(id) ON DELETE SET NULL,
  mat_number INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  status public.match_status NOT NULL DEFAULT 'queued',
  athlete_a_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
  athlete_b_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
  score_a INT NOT NULL DEFAULT 0,
  score_b INT NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
  round_index INT NOT NULL DEFAULT 0,
  match_index INT NOT NULL DEFAULT 0,
  next_match_id UUID REFERENCES public.competition_matches(id) ON DELETE SET NULL,
  next_slot TEXT CHECK (next_slot IS NULL OR next_slot IN ('a', 'b')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX competition_matches_comp_idx ON public.competition_matches (competition_id);

-- ─── Auth trigger: profile + organizer role ──────────────────────────────────
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER academies_touch BEFORE UPDATE ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER athletes_touch BEFORE UPDATE ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER competitions_touch BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER matches_touch BEFORE UPDATE ON public.competition_matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── Grants + RLS ────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Public read academies" ON public.academies
  FOR SELECT USING (true);
CREATE POLICY "Members update academy" ON public.academies
  FOR UPDATE TO authenticated
  USING (public.is_academy_admin(id)) WITH CHECK (public.is_academy_admin(id));
CREATE POLICY "Authenticated create academy" ON public.academies
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Members read membership" ON public.academy_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_academy_member(academy_id));
CREATE POLICY "Owner manages members" ON public.academy_members
  FOR ALL TO authenticated
  USING (public.is_academy_admin(academy_id))
  WITH CHECK (public.is_academy_admin(academy_id));
CREATE POLICY "User joins as owner on create" ON public.academy_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public read athletes of academy" ON public.athletes
  FOR SELECT USING (true);
CREATE POLICY "Staff manage athletes" ON public.athletes
  FOR ALL TO authenticated
  USING (public.is_academy_member(academy_id))
  WITH CHECK (public.is_academy_member(academy_id));

CREATE POLICY "Public read competitions" ON public.competitions
  FOR SELECT USING (true);
CREATE POLICY "Staff manage competitions" ON public.competitions
  FOR ALL TO authenticated
  USING (public.is_academy_member(academy_id))
  WITH CHECK (public.is_academy_member(academy_id));

CREATE POLICY "Public read divisions" ON public.competition_divisions
  FOR SELECT USING (true);
CREATE POLICY "Staff manage divisions" ON public.competition_divisions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND public.is_academy_member(c.academy_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND public.is_academy_member(c.academy_id)
    )
  );

CREATE POLICY "Public read entries" ON public.competition_entries
  FOR SELECT USING (true);
CREATE POLICY "Staff manage entries" ON public.competition_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND public.is_academy_member(c.academy_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND public.is_academy_member(c.academy_id)
    )
  );

CREATE POLICY "Public read matches" ON public.competition_matches
  FOR SELECT USING (true);
CREATE POLICY "Staff manage matches" ON public.competition_matches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND public.is_academy_member(c.academy_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND public.is_academy_member(c.academy_id)
    )
  );

-- Realtime for live brackets / mats
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competitions;
