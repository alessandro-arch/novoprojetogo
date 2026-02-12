
-- Add terms tracking columns to reviewers
ALTER TABLE public.reviewers 
ADD COLUMN IF NOT EXISTS first_terms_accepted_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS terms_version text DEFAULT NULL;
