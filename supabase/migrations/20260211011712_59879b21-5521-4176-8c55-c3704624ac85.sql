
-- Add deleted_at column for soft delete
ALTER TABLE public.editais ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for filtering out deleted editals
CREATE INDEX idx_editais_deleted_at ON public.editais (deleted_at) WHERE deleted_at IS NULL;
