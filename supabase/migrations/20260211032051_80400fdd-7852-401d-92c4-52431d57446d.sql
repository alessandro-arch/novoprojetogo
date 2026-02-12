
-- Add cpf_hash to profiles for secure CPF-based login lookup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf_hash text;

-- Create index for fast CPF hash lookups
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_hash ON public.profiles (cpf_hash) WHERE cpf_hash IS NOT NULL;

-- Backfill cpf_hash from existing profiles with CPF
-- Note: This only works for profiles that have a full 11-digit CPF stored
-- We'll handle this via application code going forward

-- RPC function for CPF-to-email lookup (security definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.lookup_email_by_cpf_hash(p_cpf_hash text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE cpf_hash = p_cpf_hash LIMIT 1
$$;
