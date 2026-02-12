
-- =============================================
-- Phase D: Official Submissions with Protocol & PDF
-- =============================================

-- 1) edital_submissions (official submissions)
CREATE TABLE public.edital_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  protocol TEXT UNIQUE,
  form_version_id UUID REFERENCES public.form_versions(id),
  answers JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_edital_submissions_user_edital ON public.edital_submissions(edital_id, user_id);
CREATE INDEX idx_edital_submissions_edital ON public.edital_submissions(edital_id);
CREATE INDEX idx_edital_submissions_status ON public.edital_submissions(status);

CREATE TRIGGER update_edital_submissions_updated_at
  BEFORE UPDATE ON public.edital_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.edital_submissions ENABLE ROW LEVEL SECURITY;

-- User reads own submissions
CREATE POLICY "Users read own submissions"
  ON public.edital_submissions FOR SELECT
  USING (auth.uid() = user_id);

-- User inserts own submissions
CREATE POLICY "Users insert own submissions"
  ON public.edital_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User updates own draft submissions
CREATE POLICY "Users update own draft submissions"
  ON public.edital_submissions FOR UPDATE
  USING (auth.uid() = user_id);

-- Org admins read all submissions for their editais
CREATE POLICY "Org admins read edital submissions"
  ON public.edital_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.editais e
      JOIN public.organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = edital_submissions.edital_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

-- icca_admin full access
CREATE POLICY "icca_admin full access edital_submissions"
  ON public.edital_submissions FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 2) edital_submission_drafts (auto-save drafts)
CREATE TABLE public.edital_submission_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_submission_drafts_unique ON public.edital_submission_drafts(edital_id, user_id);

CREATE TRIGGER update_edital_submission_drafts_updated_at
  BEFORE UPDATE ON public.edital_submission_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.edital_submission_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drafts"
  ON public.edital_submission_drafts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) edital_submission_files (PDFs)
CREATE TABLE public.edital_submission_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.edital_submissions(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL DEFAULT 'proposal_pdf',
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submission_files_submission ON public.edital_submission_files(submission_id);

ALTER TABLE public.edital_submission_files ENABLE ROW LEVEL SECURITY;

-- User reads own submission files
CREATE POLICY "Users read own submission files"
  ON public.edital_submission_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_submissions es
      WHERE es.id = edital_submission_files.submission_id AND es.user_id = auth.uid()
    )
  );

-- Org admins read submission files
CREATE POLICY "Org admins read submission files"
  ON public.edital_submission_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_submissions es
      JOIN public.editais e ON e.id = es.edital_id
      JOIN public.organization_members om ON om.organization_id = e.organization_id
      WHERE es.id = edital_submission_files.submission_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'edital_manager', 'icca_admin')
    )
  );

-- Insert by system (via edge function with service role)
CREATE POLICY "Service insert submission files"
  ON public.edital_submission_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.edital_submissions es
      WHERE es.id = edital_submission_files.submission_id AND es.user_id = auth.uid()
    )
  );

-- icca_admin full access
CREATE POLICY "icca_admin full access submission files"
  ON public.edital_submission_files FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 4) Protocol generation function
CREATE OR REPLACE FUNCTION public.generate_submission_protocol(p_edital_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seq INT;
  _edital_short TEXT;
BEGIN
  -- Get sequential number for this edital
  SELECT count(*) + 1 INTO _seq
  FROM edital_submissions
  WHERE edital_id = p_edital_id AND protocol IS NOT NULL;

  -- Short edital ID (first 4 chars uppercase)
  _edital_short := upper(substring(p_edital_id::text from 1 for 4));

  RETURN 'ED-' || extract(year from now())::text || '-' || _edital_short || '-' || lpad(_seq::text, 4, '0');
END;
$$;
