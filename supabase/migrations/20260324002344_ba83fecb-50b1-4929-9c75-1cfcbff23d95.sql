-- 1. Update validate_fomento_role to accept 'superadmin'
CREATE OR REPLACE FUNCTION public.validate_fomento_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fomento_role IS NOT NULL 
     AND NEW.fomento_role NOT IN ('superadmin', 'admin', 'gestor') THEN
    RAISE EXCEPTION 'fomento_role must be superadmin, admin, gestor, or NULL';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Update has_fomento_admin to also match 'superadmin'
CREATE OR REPLACE FUNCTION public.has_fomento_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND fomento_role IN ('superadmin', 'admin')
  )
$function$;

-- 3. Update set_fomento_role to accept 'superadmin'
CREATE OR REPLACE FUNCTION public.set_fomento_role(_target_user_id uuid, _role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_fomento_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only fomento admins can manage roles';
  END IF;
  IF _role IS NOT NULL AND _role NOT IN ('superadmin', 'admin', 'gestor') THEN
    RAISE EXCEPTION 'Role must be superadmin, admin, gestor, or NULL';
  END IF;
  UPDATE public.profiles SET fomento_role = _role WHERE user_id = _target_user_id;
END;
$function$;