CREATE OR REPLACE FUNCTION public.sd_suspend_locked_student()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'trancado' THEN
    NEW.service_desk_access_active := false;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sd_students_suspend_locked ON public.sd_students;
CREATE TRIGGER sd_students_suspend_locked BEFORE INSERT OR UPDATE ON public.sd_students
FOR EACH ROW EXECUTE FUNCTION public.sd_suspend_locked_student();
UPDATE public.sd_students SET service_desk_access_active = false WHERE status = 'trancado';