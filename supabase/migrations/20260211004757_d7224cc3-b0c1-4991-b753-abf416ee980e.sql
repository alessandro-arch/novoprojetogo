-- Add CNPq area code to submissions and drafts
ALTER TABLE public.edital_submissions 
ADD COLUMN cnpq_area_code TEXT;

ALTER TABLE public.edital_submission_drafts 
ADD COLUMN cnpq_area_code TEXT;

-- Add index for area-based queries
CREATE INDEX idx_edital_submissions_cnpq_area ON public.edital_submissions(cnpq_area_code);

-- Update the submissions_blind view to NOT expose cnpq_area_code (blind review)
-- The existing view already doesn't include it, so no changes needed there