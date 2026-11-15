-- Profile lookup is an administrative invitation tool, never an anonymous directory.
CREATE OR REPLACE FUNCTION public.find_profile_by_email(_email text)
RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text, fomento_org_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT p.user_id, p.email, p.full_name, p.fomento_role, p.fomento_org_id
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(_email))
    AND (
      auth.role() = 'service_role'
      OR (auth.uid() IS NOT NULL AND (
        public.has_fomento_admin(auth.uid())
        OR public.has_role(auth.uid(), 'icca_admin')
        OR EXISTS (SELECT 1 FROM public.sd_members m
                   WHERE m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'ativo')
      ))
    )
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.find_profile_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_profile_by_email(text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
