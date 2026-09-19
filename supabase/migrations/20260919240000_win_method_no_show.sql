-- Allow no_show win method (mesa Smoothcomp-like)
ALTER TABLE public.competition_matches
  DROP CONSTRAINT IF EXISTS competition_matches_win_method_check;

ALTER TABLE public.competition_matches
  ADD CONSTRAINT competition_matches_win_method_check
  CHECK (
    win_method IS NULL OR win_method IN (
      'points', 'submission', 'decision', 'disqualification', 'walkover', 'no_show', 'other'
    )
  );
