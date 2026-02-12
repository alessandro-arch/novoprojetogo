
-- =============================================
-- Phase C: Form Builder tables
-- =============================================

-- 1) form_sections
CREATE TABLE public.form_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.edital_forms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_sections_form_id ON public.form_sections(form_id);

CREATE TRIGGER update_form_sections_updated_at
  BEFORE UPDATE ON public.form_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read form_sections"
  ON public.form_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE ef.id = form_sections.form_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert form_sections"
  ON public.form_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE ef.id = form_sections.form_id AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

CREATE POLICY "Org admins can update form_sections"
  ON public.form_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE ef.id = form_sections.form_id AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

CREATE POLICY "Org admins can delete form_sections"
  ON public.form_sections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE ef.id = form_sections.form_id AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

-- 2) Add section_id and options_source to form_questions
ALTER TABLE public.form_questions
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.form_sections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS options_source TEXT;

-- 3) form_question_options (for manual select options)
CREATE TABLE public.form_question_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.form_questions(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_question_options_question_id ON public.form_question_options(question_id);

CREATE TRIGGER update_form_question_options_updated_at
  BEFORE UPDATE ON public.form_question_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.form_question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read form_question_options"
  ON public.form_question_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.form_questions fq
      JOIN public.edital_forms ef ON ef.id = fq.form_id
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE fq.id = form_question_options.question_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert form_question_options"
  ON public.form_question_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_questions fq
      JOIN public.edital_forms ef ON ef.id = fq.form_id
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE fq.id = form_question_options.question_id AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

CREATE POLICY "Org admins can update form_question_options"
  ON public.form_question_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.form_questions fq
      JOIN public.edital_forms ef ON ef.id = fq.form_id
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE fq.id = form_question_options.question_id AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

CREATE POLICY "Org admins can delete form_question_options"
  ON public.form_question_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.form_questions fq
      JOIN public.edital_forms ef ON ef.id = fq.form_id
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE fq.id = form_question_options.question_id AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

-- 4) form_versions (immutable snapshots)
CREATE TABLE public.form_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.edital_forms(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_form_versions_form_id ON public.form_versions(form_id);

ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read form_versions"
  ON public.form_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE ef.id = form_versions.form_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert form_versions"
  ON public.form_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      JOIN public.organization_members om ON om.organization_id = ef.organization_id
      WHERE ef.id = form_versions.form_id AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

-- 5) form_response_drafts
CREATE TABLE public.form_response_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.edital_forms(id) ON DELETE CASCADE,
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_form_response_drafts_unique ON public.form_response_drafts(form_id, user_id);
CREATE INDEX idx_form_response_drafts_edital ON public.form_response_drafts(edital_id);

CREATE TRIGGER update_form_response_drafts_updated_at
  BEFORE UPDATE ON public.form_response_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.form_response_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drafts"
  ON public.form_response_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON public.form_response_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON public.form_response_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON public.form_response_drafts FOR DELETE
  USING (auth.uid() = user_id);
