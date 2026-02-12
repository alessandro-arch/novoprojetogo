
-- Create form_knowledge_areas table
CREATE TABLE public.form_knowledge_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.edital_forms(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint on form_id + lower(name)
CREATE UNIQUE INDEX form_knowledge_areas_form_name_unique ON public.form_knowledge_areas (form_id, lower(name));

-- Index on form_id for faster lookups
CREATE INDEX form_knowledge_areas_form_id_idx ON public.form_knowledge_areas (form_id);

-- Trigger for updated_at
CREATE TRIGGER update_form_knowledge_areas_updated_at
  BEFORE UPDATE ON public.form_knowledge_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.form_knowledge_areas ENABLE ROW LEVEL SECURITY;

-- Read: org members can read areas of their org's forms
CREATE POLICY "org members read form_knowledge_areas"
  ON public.form_knowledge_areas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      WHERE ef.id = form_knowledge_areas.form_id
        AND is_org_member(auth.uid(), ef.organization_id)
    )
  );

-- Write: org admin/manager can manage areas
CREATE POLICY "org staff manages form_knowledge_areas"
  ON public.form_knowledge_areas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      WHERE ef.id = form_knowledge_areas.form_id
        AND (
          has_org_role(auth.uid(), ef.organization_id, 'org_admin'::app_role)
          OR has_org_role(auth.uid(), ef.organization_id, 'edital_manager'::app_role)
        )
    )
  );

-- icca_admin full access
CREATE POLICY "icca_admin full access form_knowledge_areas"
  ON public.form_knowledge_areas
  FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));
