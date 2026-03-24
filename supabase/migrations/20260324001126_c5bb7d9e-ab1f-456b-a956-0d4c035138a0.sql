
DROP FUNCTION IF EXISTS public.find_profile_by_email(text);

CREATE FUNCTION public.find_profile_by_email(_email text)
 RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text, fomento_org_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.email, p.full_name, p.fomento_role, p.fomento_org_id
  FROM public.profiles p WHERE p.email = _email LIMIT 1
$function$;
