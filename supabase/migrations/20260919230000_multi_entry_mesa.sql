-- Multi-entry (categoria + absoluto) + mesa / display fields on matches

-- Allow same athlete in multiple divisions of one event
ALTER TABLE public.competition_entries
  DROP CONSTRAINT IF EXISTS competition_entries_competition_id_athlete_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS competition_entries_comp_athlete_div_uidx
  ON public.competition_entries (
    competition_id,
    athlete_id,
    COALESCE(division_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Match ops for mesa / scoreboard / display
ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS win_method TEXT
    CHECK (
      win_method IS NULL OR win_method IN (
        'points', 'submission', 'decision', 'disqualification', 'walkover', 'other'
      )
    ),
  ADD COLUMN IF NOT EXISTS advantages_a INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advantages_b INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalties_a INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalties_b INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clock_seconds INT NOT NULL DEFAULT 360,
  ADD COLUMN IF NOT EXISTS clock_running BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clock_updated_at TIMESTAMPTZ;
