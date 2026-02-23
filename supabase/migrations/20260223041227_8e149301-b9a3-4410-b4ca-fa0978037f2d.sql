-- Fix: Restrict anonymous access to only active organizations
DROP POLICY IF EXISTS "orgs_anon_select" ON public.organizations;
CREATE POLICY "orgs_anon_select" ON public.organizations
  FOR SELECT TO anon
  USING (is_active = true);