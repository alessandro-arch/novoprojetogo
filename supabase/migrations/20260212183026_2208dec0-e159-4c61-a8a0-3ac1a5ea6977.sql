
-- Add missing primary key to organizations
ALTER TABLE public.organizations ADD PRIMARY KEY (id);

-- Now add the FK from editais to organizations
ALTER TABLE public.editais
  ADD CONSTRAINT editais_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
