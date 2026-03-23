
CREATE OR REPLACE FUNCTION public.list_fomento_users()
RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.email, p.full_name, p.fomento_role
  FROM public.profiles p WHERE p.fomento_role IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.set_fomento_role(_target_user_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_fomento_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only fomento admins can manage roles';
  END IF;
  IF _role IS NOT NULL AND _role NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Role must be admin, gestor, or NULL';
  END IF;
  UPDATE public.profiles SET fomento_role = _role WHERE user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_profile_by_email(_email text)
RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.email, p.full_name, p.fomento_role
  FROM public.profiles p WHERE p.email = _email LIMIT 1
$$;
