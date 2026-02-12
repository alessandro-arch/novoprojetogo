
-- Allow reviewers to SELECT proposals they are assigned to
CREATE POLICY "reviewer sees assigned proposals"
ON public.proposals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.review_assignments ra
    WHERE ra.proposal_id = proposals.id
      AND ra.reviewer_user_id = auth.uid()
  )
);
