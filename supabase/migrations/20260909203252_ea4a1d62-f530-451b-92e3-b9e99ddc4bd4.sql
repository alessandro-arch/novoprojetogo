CREATE OR REPLACE FUNCTION public.normalize_ppg(_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  IF _value IS NULL OR btrim(_value) = '' THEN
    RETURN NULL;
  END IF;

  -- minúsculas, sem acentos, sem pontuação, espaços colapsados
  v := lower(btrim(_value));
  v := translate(v,
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn');
  v := regexp_replace(v, '[^a-z0-9 ]+', ' ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));

  IF v LIKE '%seguranca publica%' OR v LIKE '%ppgseg%' THEN
    RETURN 'Segurança Pública';
  ELSIF v LIKE '%biotecnologia vegetal%' THEN
    RETURN 'Biotecnologia Vegetal';
  ELSIF v LIKE '%assistencia farmaceutica%' THEN
    RETURN 'Assistência Farmacêutica';
  ELSIF v LIKE '%ciencias farmaceuticas%' OR v LIKE '%ciencia farmaceutica%' OR v LIKE '%ppgcf%' THEN
    RETURN 'Ciências Farmacêuticas';
  ELSIF v LIKE '%ciencia animal%' OR v LIKE '%ciencias animais%' THEN
    RETURN 'Ciência Animal';
  ELSIF v LIKE '%arquitetura e cidade%' OR v LIKE '%arquitetura e cidades%' THEN
    RETURN 'Arquitetura e Cidade';
  ELSIF v LIKE '%sociologia politica%' THEN
    RETURN 'Sociologia Política';
  END IF;

  -- não reconhecido: preserva o valor original para revisão manual
  RETURN btrim(_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_normalize_ppg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ppg_nome := public.normalize_ppg(NEW.ppg_nome);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_ppg_projects ON public.fomento_projects;
CREATE TRIGGER normalize_ppg_projects
BEFORE INSERT OR UPDATE ON public.fomento_projects
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_ppg();

DROP TRIGGER IF EXISTS normalize_ppg_bolsistas ON public.fomento_bolsistas;
CREATE TRIGGER normalize_ppg_bolsistas
BEFORE INSERT OR UPDATE ON public.fomento_bolsistas
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_ppg();

DROP TRIGGER IF EXISTS normalize_ppg_parcerias ON public.fomento_parcerias;
CREATE TRIGGER normalize_ppg_parcerias
BEFORE INSERT OR UPDATE ON public.fomento_parcerias
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_ppg();