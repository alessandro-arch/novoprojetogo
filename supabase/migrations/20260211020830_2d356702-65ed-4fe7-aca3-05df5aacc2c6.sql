
-- Add invite_code column to reviewer_invites
ALTER TABLE public.reviewer_invites
  ADD COLUMN IF NOT EXISTS invite_code text;

-- Unique index per org for invite codes
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviewer_invites_code_org 
  ON public.reviewer_invites (org_id, invite_code) 
  WHERE invite_code IS NOT NULL AND used_at IS NULL;

-- Make token_hash nullable (codes can work without token)
ALTER TABLE public.reviewer_invites 
  ALTER COLUMN token_hash DROP NOT NULL;
