-- Persist scoreboard side swap so display / TV follow mesa
ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS sides_swapped BOOLEAN NOT NULL DEFAULT false;
