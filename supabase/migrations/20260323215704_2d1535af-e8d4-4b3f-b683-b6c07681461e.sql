
-- Table: fomento_organizations
CREATE TABLE public.fomento_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sigla TEXT,
  emec_code TEXT,
  plan TEXT NOT NULL DEFAULT 'basic',
  admin_user_id UUID,
  admin_name TEXT,
  admin_email TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for plan and status
CREATE OR REPLACE FUNCTION public.validate_fomento_organization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.plan NOT IN ('basic', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'plan must be basic, pro, or enterprise';
  END IF;
  IF NEW.status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'status must be ativo or inativo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fomento_org
BEFORE INSERT OR UPDATE ON public.fomento_organizations
FOR EACH ROW EXECUTE FUNCTION public.validate_fomento_organization();

-- Updated_at trigger
CREATE TRIGGER trg_fomento_org_updated_at
BEFORE UPDATE ON public.fomento_organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.fomento_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fomento_orgs_select" ON public.fomento_organizations
FOR SELECT TO authenticated
USING (has_fomento_admin(auth.uid()));

CREATE POLICY "fomento_orgs_insert" ON public.fomento_organizations
FOR INSERT TO authenticated
WITH CHECK (has_fomento_admin(auth.uid()));

CREATE POLICY "fomento_orgs_update" ON public.fomento_organizations
FOR UPDATE TO authenticated
USING (has_fomento_admin(auth.uid()));

CREATE POLICY "fomento_orgs_delete" ON public.fomento_organizations
FOR DELETE TO authenticated
USING (has_fomento_admin(auth.uid()));
