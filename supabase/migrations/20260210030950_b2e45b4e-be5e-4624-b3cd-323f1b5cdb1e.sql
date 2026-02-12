
-- Add reviewer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reviewer';

-- Add review columns to editais
ALTER TABLE public.editais
  ADD COLUMN IF NOT EXISTS review_deadline date,
  ADD COLUMN IF NOT EXISTS min_reviewers_per_proposal integer DEFAULT 3;

-- Review assignments (created before scoring_criteria policy references it)
CREATE TABLE public.review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  assigned_by uuid NOT NULL,
  UNIQUE (proposal_id, reviewer_user_id)
);
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;

-- Scoring criteria (barema) per edital
CREATE TABLE public.scoring_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id uuid NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  weight numeric(5,2) NOT NULL DEFAULT 1.0,
  max_score numeric(5,2) NOT NULL DEFAULT 10.0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scoring_criteria ENABLE ROW LEVEL SECURITY;

-- Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL,
  overall_score numeric(5,2),
  recommendation text CHECK (recommendation IN ('approved', 'approved_with_reservations', 'not_approved')),
  comments_to_committee text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Review scores
CREATE TABLE public.review_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  criteria_id uuid NOT NULL REFERENCES public.scoring_criteria(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL,
  comment text,
  UNIQUE (review_id, criteria_id)
);
ALTER TABLE public.review_scores ENABLE ROW LEVEL SECURITY;

-- Proposal decisions
CREATE TABLE public.proposal_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE REFERENCES public.proposals(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved', 'approved_with_adjustments', 'not_approved')),
  justification text,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proposal_decisions ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====

-- review_assignments policies
CREATE POLICY "icca_admin full access review_assignments"
  ON public.review_assignments FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages review_assignments"
  ON public.review_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = review_assignments.proposal_id
    AND (has_org_role(auth.uid(), p.organization_id, 'org_admin'::app_role)
      OR has_org_role(auth.uid(), p.organization_id, 'edital_manager'::app_role))
  ));

CREATE POLICY "reviewer sees own assignments"
  ON public.review_assignments FOR SELECT
  USING (reviewer_user_id = auth.uid());

CREATE POLICY "reviewer updates own assignment status"
  ON public.review_assignments FOR UPDATE
  USING (reviewer_user_id = auth.uid());

-- scoring_criteria policies
CREATE POLICY "icca_admin full access scoring_criteria"
  ON public.scoring_criteria FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages scoring_criteria"
  ON public.scoring_criteria FOR ALL
  USING (EXISTS (
    SELECT 1 FROM editais e
    WHERE e.id = scoring_criteria.edital_id
    AND (has_org_role(auth.uid(), e.organization_id, 'org_admin'::app_role)
      OR has_org_role(auth.uid(), e.organization_id, 'edital_manager'::app_role))
  ));

CREATE POLICY "reviewers see scoring_criteria of assigned editais"
  ON public.scoring_criteria FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM review_assignments ra
    JOIN proposals p ON p.id = ra.proposal_id
    WHERE p.edital_id = scoring_criteria.edital_id
    AND ra.reviewer_user_id = auth.uid()
  ));

-- reviews policies
CREATE POLICY "icca_admin full access reviews"
  ON public.reviews FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff sees org reviews"
  ON public.reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = reviews.proposal_id
    AND (has_org_role(auth.uid(), p.organization_id, 'org_admin'::app_role)
      OR has_org_role(auth.uid(), p.organization_id, 'edital_manager'::app_role))
  ));

CREATE POLICY "reviewer manages own reviews"
  ON public.reviews FOR ALL
  USING (reviewer_user_id = auth.uid())
  WITH CHECK (reviewer_user_id = auth.uid());

-- review_scores policies
CREATE POLICY "icca_admin full access review_scores"
  ON public.review_scores FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff sees org review_scores"
  ON public.review_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM reviews r
    JOIN proposals p ON p.id = r.proposal_id
    WHERE r.id = review_scores.review_id
    AND (has_org_role(auth.uid(), p.organization_id, 'org_admin'::app_role)
      OR has_org_role(auth.uid(), p.organization_id, 'edital_manager'::app_role))
  ));

CREATE POLICY "reviewer manages own review_scores"
  ON public.review_scores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.id = review_scores.review_id AND r.reviewer_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.id = review_scores.review_id AND r.reviewer_user_id = auth.uid()
  ));

-- proposal_decisions policies
CREATE POLICY "icca_admin full access decisions"
  ON public.proposal_decisions FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages decisions"
  ON public.proposal_decisions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = proposal_decisions.proposal_id
    AND (has_org_role(auth.uid(), p.organization_id, 'org_admin'::app_role)
      OR has_org_role(auth.uid(), p.organization_id, 'edital_manager'::app_role))
  ));

CREATE POLICY "proponente sees own decision"
  ON public.proposal_decisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = proposal_decisions.proposal_id
    AND p.proponente_user_id = auth.uid()
  ));
