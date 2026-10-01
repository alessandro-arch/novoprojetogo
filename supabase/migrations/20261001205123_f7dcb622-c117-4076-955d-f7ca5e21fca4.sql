ALTER TABLE public.sd_students
ADD COLUMN source_period text;

COMMENT ON COLUMN public.sd_students.source_period IS
'Period/semester of the latest confirmed import that supplied the current student data.';