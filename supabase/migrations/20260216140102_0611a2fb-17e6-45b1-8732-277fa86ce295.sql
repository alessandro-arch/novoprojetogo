
-- 1. Add cpf_last4 column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf_last4 text;

-- 2. Migrate existing data: extract last 4 digits before dropping
UPDATE public.profiles SET cpf_last4 = right(cpf, 4) WHERE cpf IS NOT NULL AND cpf_last4 IS NULL;

-- 3. Drop the plaintext CPF column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cpf;

-- 4. Secure lookup_email_by_cpf_hash to require authentication
CREATE OR REPLACE FUNCTION public.lookup_email_by_cpf_hash(p_cpf_hash text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN (SELECT email FROM profiles WHERE cpf_hash = p_cpf_hash LIMIT 1);
END;
$$;
