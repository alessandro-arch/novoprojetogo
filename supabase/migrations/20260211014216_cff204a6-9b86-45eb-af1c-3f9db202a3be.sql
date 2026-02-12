
-- Create institutions table
CREATE TABLE public.institutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  sigla text,
  category text,
  organization_type text,
  uf text,
  municipio text,
  source text NOT NULL DEFAULT 'eMEC',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Public read access (reference data)
CREATE POLICY "Anyone can read institutions"
  ON public.institutions FOR SELECT
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins manage institutions"
  ON public.institutions FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- Index for fast text search
CREATE INDEX idx_institutions_name_trgm ON public.institutions USING gin (name gin_trgm_ops);
CREATE INDEX idx_institutions_source ON public.institutions (source);

-- Add institution fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN institution_id uuid REFERENCES public.institutions(id),
  ADD COLUMN institution_custom_name text,
  ADD COLUMN institution_type text;

-- Add institution fields to reviewers
ALTER TABLE public.reviewers
  ADD COLUMN institution_id uuid REFERENCES public.institutions(id),
  ADD COLUMN institution_custom_name text,
  ADD COLUMN institution_type text;
