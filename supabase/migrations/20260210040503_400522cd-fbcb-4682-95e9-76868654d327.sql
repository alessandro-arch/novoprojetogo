
-- 1. Add columns to knowledge_areas for edital-scoped areas
ALTER TABLE public.knowledge_areas 
  ADD COLUMN IF NOT EXISTS edital_id uuid REFERENCES editais(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS level smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Create edital_forms table
CREATE TABLE IF NOT EXISTS public.edital_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  edital_id uuid NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  knowledge_area_mode text NOT NULL DEFAULT 'single' CHECK (knowledge_area_mode IN ('single', 'multiple', 'none')),
  knowledge_area_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edital_id)
);

ALTER TABLE public.edital_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icca_admin full access edital_forms" ON public.edital_forms
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages edital_forms" ON public.edital_forms
  FOR ALL USING (
    has_org_role(auth.uid(), organization_id, 'org_admin'::app_role) OR 
    has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role)
  );

CREATE POLICY "org members read edital_forms" ON public.edital_forms
  FOR SELECT USING (is_org_member(auth.uid(), organization_id));

-- 3. Create form_questions table
CREATE TABLE IF NOT EXISTS public.form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES edital_forms(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'default',
  type text NOT NULL DEFAULT 'short_text',
  label text NOT NULL,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  options jsonb,
  validation_rules jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icca_admin full access form_questions" ON public.form_questions
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages form_questions" ON public.form_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM edital_forms ef
      WHERE ef.id = form_questions.form_id
      AND (has_org_role(auth.uid(), ef.organization_id, 'org_admin'::app_role) OR
           has_org_role(auth.uid(), ef.organization_id, 'edital_manager'::app_role))
    )
  );

CREATE POLICY "org members read form_questions" ON public.form_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM edital_forms ef
      WHERE ef.id = form_questions.form_id
      AND is_org_member(auth.uid(), ef.organization_id)
    )
  );

-- 4. Trigger for updated_at on new tables
CREATE TRIGGER update_edital_forms_updated_at
  BEFORE UPDATE ON public.edital_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_form_questions_updated_at
  BEFORE UPDATE ON public.form_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_areas_updated_at
  BEFORE UPDATE ON public.knowledge_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
