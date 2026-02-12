
-- Update the get_anonymized_proposal function to include submission answers and form questions
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
  _form_questions jsonb;
  _submission_answers jsonb;
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

  -- Get answers from proposal_answers
  SELECT answers_json INTO _answers FROM proposal_answers WHERE proposal_id = _proposal.id;

  -- If no proposal_answers, try edital_submissions
  IF _answers IS NULL THEN
    SELECT es.answers INTO _submission_answers
    FROM edital_submissions es
    WHERE es.edital_id = _proposal.edital_id
      AND es.status = 'submitted'
      AND es.user_id = (SELECT proponente_user_id FROM proposals WHERE id = _proposal.id)
    ORDER BY es.submitted_at DESC
    LIMIT 1;
    
    _answers := _submission_answers;
  END IF;

  -- Get form questions organized by sections (for display)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'section_id', sub.section_id,
      'section_title', sub.section_title,
      'section_order', sub.section_order,
      'question_id', sub.question_id,
      'label', sub.label,
      'type', sub.type,
      'question_order', sub.question_order
    ) ORDER BY sub.section_order, sub.question_order
  ), '[]'::jsonb)
  INTO _form_questions
  FROM (
    SELECT fs.id as section_id, fs.title as section_title, fs.sort_order as section_order,
           fq.id as question_id, fq.label, fq.type, fq.sort_order as question_order
    FROM edital_forms ef
    JOIN form_sections fs ON fs.form_id = ef.id
    JOIN form_questions fq ON fq.form_id = ef.id AND (fq.section_id = fs.id OR fq.section_id IS NULL)
    WHERE ef.edital_id = _proposal.edital_id
    ORDER BY fs.sort_order, fq.sort_order
  ) sub;

  -- Get files (anonymized)
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
    'form_questions', _form_questions,
    'files', _files,
    'submitted_at', _proposal.created_at
  );

  RETURN _result;
END;
$function$;
