-- Number of mats / mesas per competition
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS mats_count INT NOT NULL DEFAULT 1
    CHECK (mats_count >= 1 AND mats_count <= 24);
