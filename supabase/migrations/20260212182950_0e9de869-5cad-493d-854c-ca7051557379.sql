
-- Fix 1: Replace overly permissive audit_logs insert policy
DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Fix 2: Recreate submissions_blind view with security_invoker
DROP VIEW IF EXISTS public.submissions_blind;
CREATE VIEW public.submissions_blind
WITH (security_invoker = on) AS
SELECT
  p.id AS submission_id,
  p.edital_id,
  e.title AS edital_title,
  p.blind_code,
  p.status,
  p.created_at,
  p.submitted_at,
  p.knowledge_area_id,
  ka.name AS knowledge_area_name,
  pa.answers_json AS proposal_content,
  e.blind_review_enabled,
  e.review_deadline
FROM proposals p
JOIN editais e ON e.id = p.edital_id
LEFT JOIN knowledge_areas ka ON ka.id = p.knowledge_area_id
LEFT JOIN proposal_answers pa ON pa.proposal_id = p.id;
