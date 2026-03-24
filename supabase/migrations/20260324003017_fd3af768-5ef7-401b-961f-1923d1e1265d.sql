CREATE OR REPLACE FUNCTION public.generate_fomento_processo(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sigla text;
  _year text;
  _seq int;
BEGIN
  SELECT COALESCE(NULLIF(fo.sigla, ''), 'ORG')
  INTO _sigla
  FROM fomento_organizations fo
  WHERE fo.id = _org_id;

  IF _sigla IS NULL THEN
    _sigla := 'ORG';
  END IF;

  _year := extract(year FROM now())::text;

  SELECT count(*) + 1
  INTO _seq
  FROM fomento_projects fp
  WHERE fp.organization_id = _org_id
    AND extract(year FROM fp.created_at) = extract(year FROM now());

  RETURN _sigla || '-' || _year || '-' || lpad(_seq::text, 4, '0');
END;
$$;