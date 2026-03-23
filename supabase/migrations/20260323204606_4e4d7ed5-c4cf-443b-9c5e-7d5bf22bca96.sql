
CREATE OR REPLACE FUNCTION public.validate_fomento_role()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fomento_role IS NOT NULL AND NEW.fomento_role NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'fomento_role must be admin, gestor, or NULL';
  END IF;
  RETURN NEW;
END;
$$;
