-- Register wizard: division hierarchy + profile athlete fields

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE public.competition_divisions
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.competition_divisions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'entry'
    CHECK (kind IN ('group', 'entry')),
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IS NULL OR gender IN ('male', 'female', 'open')),
  ADD COLUMN IF NOT EXISTS age_label TEXT,
  ADD COLUMN IF NOT EXISTS age_min INT,
  ADD COLUMN IF NOT EXISTS age_max INT,
  ADD COLUMN IF NOT EXISTS weight_label TEXT;

-- Existing flat divisions become leaf entries (inscribable)
UPDATE public.competition_divisions
SET kind = 'entry'
WHERE kind IS NULL OR kind = '';

CREATE INDEX IF NOT EXISTS competition_divisions_parent_idx
  ON public.competition_divisions (parent_id);

CREATE INDEX IF NOT EXISTS competition_divisions_comp_kind_idx
  ON public.competition_divisions (competition_id, kind);
