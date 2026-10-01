CREATE TABLE public.sd_first_access_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula text NOT NULL,
  ip text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sd_first_access_attempts TO service_role;
ALTER TABLE public.sd_first_access_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX sd_faa_mat_idx ON public.sd_first_access_attempts (matricula, created_at);
CREATE INDEX sd_faa_ip_idx ON public.sd_first_access_attempts (ip, created_at);