
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fomento_role text DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.validate_fomento_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fomento_role IS NOT NULL AND NEW.fomento_role NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'fomento_role must be admin, gestor, or NULL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fomento_role ON public.profiles;
CREATE TRIGGER trg_validate_fomento_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_fomento_role();
