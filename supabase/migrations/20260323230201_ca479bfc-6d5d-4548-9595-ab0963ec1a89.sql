ALTER TABLE public.fomento_organizations 
  ADD COLUMN admin_status text NOT NULL DEFAULT 'pendente';

CREATE TABLE public.fomento_invite_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES fomento_organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  enviado_por uuid NOT NULL
);

ALTER TABLE public.fomento_invite_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fomento_invite_log_select" ON public.fomento_invite_log
  FOR SELECT TO authenticated USING (has_fomento_admin(auth.uid()));

CREATE POLICY "fomento_invite_log_insert" ON public.fomento_invite_log
  FOR INSERT TO authenticated WITH CHECK (has_fomento_admin(auth.uid()));