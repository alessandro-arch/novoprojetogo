
-- Table for CNPq official knowledge areas (reference data)
CREATE TABLE public.cnpq_areas (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level SMALLINT NOT NULL, -- 1=grande_area, 2=area, 3=subarea, 4=especialidade
  parent_code TEXT,
  full_path TEXT NOT NULL
);

ALTER TABLE public.cnpq_areas ENABLE ROW LEVEL SECURITY;

-- Reference data readable by everyone (needed for registration)
CREATE POLICY "cnpq_areas_public_read" ON public.cnpq_areas
FOR SELECT USING (true);

-- Only icca_admin can manage
CREATE POLICY "cnpq_areas_admin_manage" ON public.cnpq_areas
FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- Enable trigram for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_cnpq_areas_name_trgm ON public.cnpq_areas USING gin(name gin_trgm_ops);
CREATE INDEX idx_cnpq_areas_full_path_trgm ON public.cnpq_areas USING gin(full_path gin_trgm_ops);
CREATE INDEX idx_cnpq_areas_level ON public.cnpq_areas (level);
CREATE INDEX idx_cnpq_areas_parent ON public.cnpq_areas (parent_code);
