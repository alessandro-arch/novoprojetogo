
-- Change start_date and end_date from date to timestamptz for datetime support
ALTER TABLE public.editais
  ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz,
  ALTER COLUMN end_date TYPE timestamptz USING end_date::timestamptz;
