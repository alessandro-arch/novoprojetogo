
-- 1. FIX SECURITY: Block anonymous access to profiles
CREATE POLICY "block_anonymous_profiles_access"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Add blind_code to proposals for deterministic blind references
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS blind_code text;

-- Create unique index on blind_code per edital
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_blind_code_edital 
ON public.proposals (edital_id, blind_code) WHERE blind_code IS NOT NULL;

-- 3. Function to generate sequential blind code per edital
CREATE OR REPLACE FUNCTION public.generate_blind_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _edital_slug text;
  _seq int;
BEGIN
  -- Get edital year + sequence
  SELECT count(*) + 1 INTO _seq 
  FROM proposals 
  WHERE edital_id = NEW.edital_id AND blind_code IS NOT NULL;

  -- Format: ED-YYYY-NNN
  NEW.blind_code := 'ED' || extract(year from now())::text || '-' || lpad(_seq::text, 3, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_generate_blind_code
  BEFORE INSERT ON public.proposals
  FOR EACH ROW
  WHEN (NEW.blind_code IS NULL)
  EXECUTE FUNCTION public.generate_blind_code();

-- 4. Create view for blind submissions (what reviewers see)
CREATE OR REPLACE VIEW public.submissions_blind
WITH (security_invoker = on)
AS
SELECT 
  p.id AS submission_id,
  p.edital_id,
  p.blind_code,
  p.knowledge_area_id,
  ka.name AS knowledge_area_name,
  p.status,
  p.submitted_at,
  p.created_at,
  e.title AS edital_title,
  e.review_deadline,
  e.blind_review_enabled,
  pa.answers_json AS proposal_content
FROM proposals p
LEFT JOIN knowledge_areas ka ON ka.id = p.knowledge_area_id
LEFT JOIN editais e ON e.id = p.edital_id
LEFT JOIN proposal_answers pa ON pa.proposal_id = p.id;
-- Note: proponente_user_id, organization_id deliberately excluded

-- 5. Identity reveal tracking table
CREATE TABLE IF NOT EXISTS public.identity_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id),
  edital_id uuid NOT NULL REFERENCES editais(id),
  revealed_by uuid NOT NULL,
  reason text NOT NULL,
  revealed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.identity_reveals ENABLE ROW LEVEL SECURITY;

-- Only org staff can reveal and view reveals
CREATE POLICY "org_staff_manages_reveals"
ON public.identity_reveals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM editais e 
    WHERE e.id = identity_reveals.edital_id
    AND (has_org_role(auth.uid(), e.organization_id, 'org_admin'::app_role) 
      OR has_org_role(auth.uid(), e.organization_id, 'edital_manager'::app_role))
  )
);

CREATE POLICY "icca_admin_manages_reveals"
ON public.identity_reveals
FOR ALL
USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- Immutability: no update/delete on reveals
CREATE TRIGGER prevent_reveal_update
  BEFORE UPDATE ON public.identity_reveals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

CREATE TRIGGER prevent_reveal_delete
  BEFORE DELETE ON public.identity_reveals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Audit trigger for reveals
CREATE TRIGGER audit_identity_reveals
  AFTER INSERT ON public.identity_reveals
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('identity_reveal');

-- 6. Update get_anonymized_proposal to use blind_code
CREATE OR REPLACE FUNCTION public.get_anonymized_proposal(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _assignment record;
  _proposal record;
  _answers jsonb;
  _edital record;
  _area_name text;
  _files jsonb;
  _result jsonb;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify assignment belongs to this reviewer
  SELECT * INTO _assignment FROM review_assignments
  WHERE id = p_assignment_id AND reviewer_user_id = _user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found or not yours';
  END IF;

  -- Get proposal (WITHOUT proponent identity)
  SELECT id, edital_id, knowledge_area_id, status, created_at, blind_code
  INTO _proposal FROM proposals WHERE id = _assignment.proposal_id;

  -- Get edital info
  SELECT title, blind_review_enabled, review_deadline INTO _edital
  FROM editais WHERE id = _proposal.edital_id;

  -- Get knowledge area name
  SELECT name INTO _area_name FROM knowledge_areas WHERE id = _proposal.knowledge_area_id;

  -- Get answers
  SELECT answers_json INTO _answers FROM proposal_answers WHERE proposal_id = _proposal.id;

  -- Get files (anonymized: no original filenames)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', pf.id,
    'file_type', pf.file_type,
    'file_ref', 'Anexo_' || _proposal.blind_code || '_' || row_number() OVER (ORDER BY pf.uploaded_at),
    'uploaded_at', pf.uploaded_at
  )), '[]'::jsonb)
  INTO _files
  FROM proposal_files pf WHERE pf.proposal_id = _proposal.id;

  _result := jsonb_build_object(
    'anonymous_id', coalesce(_proposal.blind_code, get_proposal_anonymous_id(_proposal.id)),
    'edital_title', _edital.title,
    'blind_review', _edital.blind_review_enabled,
    'review_deadline', _edital.review_deadline,
    'knowledge_area', _area_name,
    'status', _proposal.status,
    'answers', _answers,
    'files', _files,
    'submitted_at', _proposal.created_at
  );

  RETURN _result;
END;
$function$;

-- 7. Backfill blind_code for existing proposals
DO $$
DECLARE
  r record;
  _seq int;
BEGIN
  FOR r IN 
    SELECT id, edital_id, created_at 
    FROM proposals 
    WHERE blind_code IS NULL
    ORDER BY edital_id, created_at
  LOOP
    SELECT count(*) + 1 INTO _seq 
    FROM proposals 
    WHERE edital_id = r.edital_id AND blind_code IS NOT NULL;
    
    UPDATE proposals SET blind_code = 'ED' || extract(year from r.created_at)::text || '-' || lpad(_seq::text, 3, '0')
    WHERE id = r.id;
  END LOOP;
END $$;
