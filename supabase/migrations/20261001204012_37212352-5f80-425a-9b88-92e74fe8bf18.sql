ALTER TABLE public.sd_students
  ADD COLUMN IF NOT EXISTS cpf_hash text,
  ADD COLUMN IF NOT EXISTS cpf_last4 text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS turma text,
  ADD COLUMN IF NOT EXISTS expected_end date,
  ADD COLUMN IF NOT EXISTS scholarship text;