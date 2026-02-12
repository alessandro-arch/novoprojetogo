
-- Create form_status enum
CREATE TYPE public.form_status AS ENUM ('draft', 'published', 'archived');

-- Create field_type enum
CREATE TYPE public.field_type AS ENUM (
  'text', 'textarea', 'number', 'date', 'file',
  'single_select', 'multi_select', 'checkbox', 'radio',
  'email', 'url', 'phone', 'currency'
);

-- ========== FORMS TABLE (library) ==========
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  status public.form_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX idx_forms_org ON public.forms(organization_id);
CREATE INDEX idx_forms_status ON public.forms(organization_id, status);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- RLS: org staff manages forms
CREATE POLICY "org staff manages forms"
  ON public.forms FOR ALL
  USING (
    has_org_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role)
  );

-- RLS: icca_admin full access
CREATE POLICY "icca_admin full access forms"
  ON public.forms FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- RLS: org members can read published forms (proponentes via edital)
CREATE POLICY "org members read published forms"
  ON public.forms FOR SELECT
  USING (status = 'published' AND is_org_member(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== FORM_FIELDS TABLE ==========
CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  section_title text,
  section_description text,
  label text NOT NULL,
  help_text text,
  field_type public.field_type NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  min_chars integer,
  max_chars integer,
  sort_order integer NOT NULL DEFAULT 0,
  options jsonb,
  validation_rules jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_fields_form ON public.form_fields(form_id);

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

-- RLS: access follows parent form
CREATE POLICY "org staff manages form_fields"
  ON public.form_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_fields.form_id
      AND (
        has_org_role(auth.uid(), f.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), f.organization_id, 'edital_manager'::app_role)
      )
    )
  );

CREATE POLICY "icca_admin full access form_fields"
  ON public.form_fields FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org members read published form_fields"
  ON public.form_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_fields.form_id
      AND f.status = 'published'
      AND is_org_member(auth.uid(), f.organization_id)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_form_fields_updated_at
  BEFORE UPDATE ON public.form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== LINK EDITAIS TO FORMS ==========
ALTER TABLE public.editais ADD COLUMN form_id uuid REFERENCES public.forms(id);

-- ========== SEQUENCE FUNCTION FOR FORM CODES ==========
CREATE OR REPLACE FUNCTION public.generate_form_code(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seq int;
BEGIN
  SELECT count(*) + 1 INTO _seq
  FROM public.forms
  WHERE organization_id = p_org_id;
  
  RETURN 'FRM-' || lpad(_seq::text, 6, '0');
END;
$$;
