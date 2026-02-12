
-- Add conflict fields to review_assignments
ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS conflict_declared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflict_reason text;

-- Create proposal-level reviewer conflicts for blocking
CREATE TABLE IF NOT EXISTS public.proposal_reviewer_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  edital_id uuid NOT NULL REFERENCES public.editais(id),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id),
  reviewer_user_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, reviewer_user_id)
);

ALTER TABLE public.proposal_reviewer_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org staff manages proposal conflicts"
ON public.proposal_reviewer_conflicts FOR ALL
USING (
  has_org_role(auth.uid(), org_id, 'org_admin'::app_role)
  OR has_org_role(auth.uid(), org_id, 'edital_manager'::app_role)
);

CREATE POLICY "icca_admin full access proposal conflicts"
ON public.proposal_reviewer_conflicts FOR ALL
USING (has_role(auth.uid(), 'icca_admin'::app_role));
