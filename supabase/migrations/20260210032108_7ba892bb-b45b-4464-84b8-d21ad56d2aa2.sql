
-- Create storage bucket for proposal files
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-files', 'proposal-files', false)
ON CONFLICT (id) DO NOTHING;

-- Proponente can upload to their own proposal folder
CREATE POLICY "proponente uploads own proposal files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proposal-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'proposals'
);

-- Proponente can view own proposal files
CREATE POLICY "proponente views own proposal files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proposal-files'
  AND auth.uid() IS NOT NULL
);

-- Proponente can delete own proposal files
CREATE POLICY "proponente deletes own proposal files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proposal-files'
  AND auth.uid() IS NOT NULL
);
