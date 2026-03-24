
CREATE OR REPLACE FUNCTION public.validate_fomento_projects()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fonte IS NOT NULL AND NEW.fonte NOT IN ('publica','privada') THEN
    RAISE EXCEPTION 'fonte must be publica, privada, or NULL';
  END IF;
  IF NEW.natureza IS NOT NULL AND NEW.natureza NOT IN ('auxilio_financeiro','bolsa') THEN
    RAISE EXCEPTION 'natureza must be auxilio_financeiro, bolsa, or NULL';
  END IF;
  IF NEW.area IS NOT NULL AND NEW.area NOT IN ('pesquisa','inovacao','extensao','ensino','servicos','estagio_tecnico','participacao_evento','publicacao') THEN
    RAISE EXCEPTION 'area must be pesquisa, inovacao, extensao, ensino, servicos, estagio_tecnico, participacao_evento, publicacao, or NULL';
  END IF;
  IF NEW.vinculo_academico IS NOT NULL AND NEW.vinculo_academico NOT IN ('ppg','graduacao','nenhum') THEN
    RAISE EXCEPTION 'vinculo_academico must be ppg, graduacao, nenhum, or NULL';
  END IF;
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('em_execucao','concluido','prestacao_contas','inadimplente') THEN
    RAISE EXCEPTION 'status must be em_execucao, concluido, prestacao_contas, inadimplente, or NULL';
  END IF;
  RETURN NEW;
END;$function$;
