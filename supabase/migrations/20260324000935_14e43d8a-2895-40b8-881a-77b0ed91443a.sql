
-- Add columns first
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fomento_org_id uuid REFERENCES public.fomento_organizations(id);

ALTER TABLE public.fomento_projects
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.fomento_organizations(id);
