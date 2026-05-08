
-- 1. Make submissions_blind view enforce RLS via the querying user
ALTER VIEW public.submissions_blind SET (security_invoker = on);

-- 2. Remove permissive self-insert on organization_members (privilege escalation)
DROP POLICY IF EXISTS org_members_insert_own ON public.organization_members;

-- 3. Restrict form_questions SELECT to org members only
DROP POLICY IF EXISTS form_questions_select ON public.form_questions;
CREATE POLICY form_questions_select ON public.form_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.edital_forms ef
      WHERE ef.id = form_questions.form_id
        AND public.is_org_member(auth.uid(), ef.organization_id)
    )
  );
