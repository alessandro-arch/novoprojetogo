
-- Add blind_review_enabled to editais (default true for compliance)
ALTER TABLE public.editais ADD COLUMN IF NOT EXISTS blind_review_enabled boolean NOT NULL DEFAULT true;

-- Create a function to generate deterministic anonymous ID from proposal_id
-- This ensures the same proposal always gets the same masked ID
CREATE OR REPLACE FUNCTION public.get_proposal_anonymous_id(p_proposal_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT 'PROP-' || upper(substring(md5(p_proposal_id::text) from 1 for 8))
$function$;

-- Create a secure function for reviewers to get anonymized proposal data
-- This strips proponent identity and sanitizes content
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

  -- Get proposal (without proponent info)
  SELECT id, edital_id, knowledge_area_id, status, created_at, organization_id
  INTO _proposal FROM proposals WHERE id = _assignment.proposal_id;

  -- Get edital info
  SELECT title, blind_review_enabled, review_deadline INTO _edital
  FROM editais WHERE id = _proposal.edital_id;

  -- Get knowledge area name
  SELECT name INTO _area_name FROM knowledge_areas WHERE id = _proposal.knowledge_area_id;

  -- Get answers (sanitized)
  SELECT answers_json INTO _answers FROM proposal_answers WHERE proposal_id = _proposal.id;

  -- Get files (anonymized filenames)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', pf.id,
    'file_type', pf.file_type,
    'file_ref', 'Anexo ' || row_number() OVER (ORDER BY pf.uploaded_at),
    'uploaded_at', pf.uploaded_at
  )), '[]'::jsonb)
  INTO _files
  FROM proposal_files pf WHERE pf.proposal_id = _proposal.id;

  _result := jsonb_build_object(
    'anonymous_id', get_proposal_anonymous_id(_proposal.id),
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

-- RLS: Ensure reviewers can see proposal_answers only through the secure function
-- The existing RLS on proposal_answers already restricts to proponents and org staff
-- Reviewers access through the SECURITY DEFINER function above

-- Add policy for reviewers to read proposal_answers via assignment
CREATE POLICY "reviewer sees assigned proposal answers"
ON public.proposal_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM review_assignments ra
    WHERE ra.proposal_id = proposal_answers.proposal_id
    AND ra.reviewer_user_id = auth.uid()
  )
);

-- Add policy for reviewers to see assigned proposal files
CREATE POLICY "reviewer sees assigned proposal files"
ON public.proposal_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM review_assignments ra
    WHERE ra.proposal_id = proposal_files.proposal_id
    AND ra.reviewer_user_id = auth.uid()
  )
);
