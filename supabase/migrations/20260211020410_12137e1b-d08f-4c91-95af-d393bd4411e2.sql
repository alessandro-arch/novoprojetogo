
-- Add CPF fields to reviewers table
ALTER TABLE public.reviewers
  ADD COLUMN IF NOT EXISTS cpf_last4 text,
  ADD COLUMN IF NOT EXISTS cpf_hash text;

-- Add comment explaining the fields
COMMENT ON COLUMN public.reviewers.cpf_last4 IS 'Last 4 digits of CPF for display/verification';
COMMENT ON COLUMN public.reviewers.cpf_hash IS 'SHA-256 hash of CPF for uniqueness check without storing raw value';

-- Create unique index per org to prevent duplicate CPFs within same org
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviewers_cpf_org ON public.reviewers (org_id, cpf_hash) WHERE cpf_hash IS NOT NULL;
