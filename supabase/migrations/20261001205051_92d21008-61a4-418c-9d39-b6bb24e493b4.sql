ALTER TABLE public.sd_students
ADD COLUMN service_desk_access_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.sd_students.service_desk_access_active IS
'Controls only the student access to Service Desk; it does not disable the shared ProjetoGO account.';