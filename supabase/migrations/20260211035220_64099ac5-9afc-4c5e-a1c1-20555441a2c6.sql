
-- Drop the recursive policy
DROP POLICY IF EXISTS "reviewer sees assigned proposals" ON public.proposals;

-- Create a SECURITY DEFINER function to check assignment without triggering RLS
CREATE OR REPLACE FUNCTION public.is_reviewer_assigned(_user_id uuid, _proposal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_assignments
    WHERE reviewer_user_id = _user_id
      AND proposal_id = _proposal_id
  )
$$;

-- Recreate policy using the function (no recursion)
CREATE POLICY "reviewer sees assigned proposals"
ON public.proposals
FOR SELECT
USING (
  public.is_reviewer_assigned(auth.uid(), id)
);
