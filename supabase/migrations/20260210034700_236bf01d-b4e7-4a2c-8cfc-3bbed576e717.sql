
-- Fix storage policies: restrict file access to authorized users only
DROP POLICY IF EXISTS "proponente views own proposal files" ON storage.objects;
DROP POLICY IF EXISTS "proponente deletes own proposal files" ON storage.objects;

-- Proper file access policy
CREATE POLICY "authorized_users_access_proposal_files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proposal-files'
  AND (
    has_role(auth.uid(), 'icca_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM proposals p
      JOIN proposal_files pf ON pf.proposal_id = p.id
      WHERE pf.file_path = name
      AND (
        p.proponente_user_id = auth.uid()
        OR has_org_role(auth.uid(), p.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), p.organization_id, 'edital_manager'::app_role)
        OR EXISTS (
          SELECT 1 FROM review_assignments ra
          WHERE ra.proposal_id = p.id AND ra.reviewer_user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "proponents_delete_own_draft_files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proposal-files'
  AND EXISTS (
    SELECT 1 FROM proposals p
    JOIN proposal_files pf ON pf.proposal_id = p.id
    WHERE pf.file_path = name
    AND p.proponente_user_id = auth.uid()
    AND p.status = 'draft'
  )
);
