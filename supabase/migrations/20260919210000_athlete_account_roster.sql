-- Athlete roster: only MatComp accounts; soft-remove

CREATE OR REPLACE FUNCTION public.add_athlete_by_email(_academy_id UUID, _email TEXT)
RETURNS public.athletes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target UUID;
  pname TEXT;
  ath public.athletes%ROWTYPE;
  email_norm TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Precisas de sessão';
  END IF;
  IF NOT public.is_academy_member(_academy_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  email_norm := lower(trim(_email));
  IF email_norm IS NULL OR email_norm = '' THEN
    RAISE EXCEPTION 'Indica o email da conta MatComp';
  END IF;

  SELECT user_id, full_name INTO target, pname
  FROM public.profiles
  WHERE lower(email) = email_norm
  LIMIT 1;

  IF target IS NULL THEN
    RAISE EXCEPTION 'Não existe conta MatComp com este email. A pessoa tem de criar conta primeiro.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.athletes
    WHERE academy_id = _academy_id AND user_id = target AND active = true
  ) THEN
    RAISE EXCEPTION 'Este utilizador já está no roster';
  END IF;

  -- Reactivate inactive row for this academy
  SELECT * INTO ath FROM public.athletes
  WHERE academy_id = _academy_id AND user_id = target
  LIMIT 1;
  IF FOUND THEN
    UPDATE public.athletes
    SET active = true,
        full_name = COALESCE(NULLIF(TRIM(full_name), ''), pname, 'Atleta')
    WHERE id = ath.id
    RETURNING * INTO ath;
    RETURN ath;
  END IF;

  -- Move from another academy if uniquely linked
  SELECT * INTO ath FROM public.athletes WHERE user_id = target LIMIT 1;
  IF FOUND THEN
    UPDATE public.athletes
    SET academy_id = _academy_id,
        active = true,
        full_name = COALESCE(NULLIF(TRIM(full_name), ''), pname, 'Atleta')
    WHERE id = ath.id
    RETURNING * INTO ath;
  ELSE
    INSERT INTO public.athletes (academy_id, user_id, full_name, belt, category, active)
    VALUES (_academy_id, target, COALESCE(NULLIF(TRIM(pname), ''), 'Atleta'), 'white', 'adult', true)
    RETURNING * INTO ath;
  END IF;

  -- Clear any pending join request for this pair
  UPDATE public.academy_join_requests
  SET status = 'accepted',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE user_id = target
    AND academy_id = _academy_id
    AND status = 'pending';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target, 'athlete')
  ON CONFLICT DO NOTHING;

  RETURN ath;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_academy_athlete(_athlete_id UUID)
RETURNS public.athletes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ath public.athletes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Precisas de sessão';
  END IF;

  SELECT * INTO ath FROM public.athletes WHERE id = _athlete_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atleta não encontrado';
  END IF;
  IF NOT public.is_academy_member(ath.academy_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.athletes
  SET active = false,
      user_id = NULL
  WHERE id = _athlete_id
  RETURNING * INTO ath;

  RETURN ath;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_athlete_by_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_academy_athlete(UUID) TO authenticated;
