
-- Add published_at timestamp to editais
ALTER TABLE public.editais
  ADD COLUMN published_at timestamptz DEFAULT NULL;

-- Backfill existing published editais
UPDATE public.editais
  SET published_at = updated_at
  WHERE status = 'published' AND published_at IS NULL;
