
-- FIX 1: Drop overly permissive profiles policy that allows ANY authenticated user to read ALL profiles
-- The existing policies (users see own profile, icca_admin sees all, org admins see org member profiles) already provide correct access
DROP POLICY IF EXISTS "block_anonymous_profiles_access" ON public.profiles;

-- FIX 2: Replace overly broad bank-statements storage policies with ownership-validated ones
DROP POLICY IF EXISTS "proponente uploads bank statements" ON storage.objects;
DROP POLICY IF EXISTS "proponente reads own bank statements" ON storage.objects;

-- Upload: only project owner or org staff can upload to their project folder
CREATE POLICY "owner uploads bank statements" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bank-statements'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM project_executions pe
      JOIN proposals p ON p.id = pe.proposal_id
      WHERE (storage.foldername(name))[1] = pe.id::text
      AND (
        p.proponente_user_id = auth.uid()
        OR has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
        OR has_role(auth.uid(), 'icca_admin'::app_role)
      )
    )
  );

-- Read: only project owner, org staff, or icca_admin can read files from their project folder
CREATE POLICY "owner reads bank statements" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bank-statements'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM project_executions pe
      JOIN proposals p ON p.id = pe.proposal_id
      WHERE (storage.foldername(name))[1] = pe.id::text
      AND (
        p.proponente_user_id = auth.uid()
        OR has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
        OR has_role(auth.uid(), 'icca_admin'::app_role)
      )
    )
  );

-- Delete: only project owner or icca_admin can delete
CREATE POLICY "owner deletes bank statements" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bank-statements'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM project_executions pe
      JOIN proposals p ON p.id = pe.proposal_id
      WHERE (storage.foldername(name))[1] = pe.id::text
      AND (
        p.proponente_user_id = auth.uid()
        OR has_role(auth.uid(), 'icca_admin'::app_role)
      )
    )
  );
