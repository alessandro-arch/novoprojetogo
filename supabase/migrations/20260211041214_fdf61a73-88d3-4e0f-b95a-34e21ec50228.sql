
-- Add is_public column to editais
ALTER TABLE public.editais
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Allow unauthenticated (anon) users to read public published editais
-- This uses the anon role, so no auth.uid() check
CREATE POLICY "anyone can view public published editais"
  ON public.editais
  FOR SELECT
  TO anon, authenticated
  USING (
    is_public = true
    AND status = 'published'
    AND deleted_at IS NULL
  );
