
-- 1. Add integrity tracking columns to edital_submissions
ALTER TABLE public.edital_submissions
  ADD COLUMN IF NOT EXISTS integrity_hash text,
  ADD COLUMN IF NOT EXISTS pdf_integrity_hash text,
  ADD COLUMN IF NOT EXISTS integrity_status text DEFAULT 'PENDING';

-- 2. Create private archive bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('archive', 'archive', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Archive bucket RLS: only service_role can upload
CREATE POLICY "service_uploads_archives"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'archive' AND auth.role() = 'service_role'
  );

-- 4. Archive bucket RLS: org staff and icca_admin can read
CREATE POLICY "org_staff_reads_archives"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'archive' AND (
      has_role(auth.uid(), 'icca_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE (storage.foldername(name))[1] = o.id::text
        AND (
          has_org_role(auth.uid(), o.id, 'org_admin'::app_role)
          OR has_org_role(auth.uid(), o.id, 'edital_manager'::app_role)
        )
      )
    )
  );

-- 5. Block anonymous access to profiles
CREATE POLICY "profiles_block_anon"
  ON public.profiles FOR SELECT
  TO anon
  USING (false);

-- 6. Block anonymous access to project_bank_accounts
CREATE POLICY "bank_accounts_block_anon"
  ON public.project_bank_accounts FOR SELECT
  TO anon
  USING (false);
