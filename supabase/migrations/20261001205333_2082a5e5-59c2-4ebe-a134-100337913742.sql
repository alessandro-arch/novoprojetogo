CREATE POLICY "profiles_select_sd_institution_members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.sd_is_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.sd_members viewer
    JOIN public.sd_members subject
      ON subject.organization_id = viewer.organization_id
    WHERE viewer.user_id = auth.uid()
      AND viewer.role = 'admin'
      AND viewer.status = 'ativo'
      AND subject.user_id = profiles.user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.sd_members viewer
    JOIN public.sd_group_members grouped
      ON grouped.organization_id = viewer.organization_id
    WHERE viewer.user_id = auth.uid()
      AND viewer.role = 'admin'
      AND viewer.status = 'ativo'
      AND grouped.user_id = profiles.user_id
  )
);