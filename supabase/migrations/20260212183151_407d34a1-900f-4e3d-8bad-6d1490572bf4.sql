
-- Allow anonymous users to read public editais (for landing page)
CREATE POLICY "editais_anon_public_select" ON public.editais FOR SELECT TO anon USING (is_public = true AND deleted_at IS NULL AND status = 'published');

-- Allow anonymous users to read organizations (needed for join)
CREATE POLICY "orgs_anon_select" ON public.organizations FOR SELECT TO anon USING (true);
