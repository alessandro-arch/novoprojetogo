
-- The previous migration that DROPped list_fomento_users and find_profile_by_email
-- was in a failed transaction, so find_profile_by_email still has the old signature.
-- list_fomento_users was successfully recreated in a subsequent migration.
-- We only need to fix find_profile_by_email now.

-- Check: find_profile_by_email still has old return type, need to drop first
DO $$
BEGIN
  -- Drop if exists (handles both cases)
  DROP FUNCTION IF EXISTS public.find_profile_by_email(text);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

CREATE FUNCTION public.find_profile_by_email(_email text)
 RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text, fomento_org_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.email, p.full_name, p.fomento_role, p.fomento_org_id
  FROM public.profiles p WHERE p.email = _email LIMIT 1
$function$;
