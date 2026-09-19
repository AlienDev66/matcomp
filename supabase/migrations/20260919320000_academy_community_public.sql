-- Public academy community: staff contacts for public profile pages

CREATE OR REPLACE FUNCTION public.get_academy_public_staff(_academy_id UUID)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  full_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.user_id,
    m.role::text,
    COALESCE(NULLIF(p.full_name, ''), NULLIF(p.email, ''), 'Staff') AS full_name
  FROM public.academy_members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.academy_id = _academy_id
    AND m.role IN ('owner', 'admin', 'staff')
  ORDER BY
    CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_academy_public_staff(UUID) TO anon, authenticated;

-- Ensure ranking tables are readable on community page (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ranking_seasons'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read ranking_seasons" ON public.ranking_seasons';
    EXECUTE 'CREATE POLICY "Public read ranking_seasons" ON public.ranking_seasons FOR SELECT USING (true)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ranking_rows'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read ranking_rows" ON public.ranking_rows';
    EXECUTE 'CREATE POLICY "Public read ranking_rows" ON public.ranking_rows FOR SELECT USING (true)';
  END IF;
END $$;
