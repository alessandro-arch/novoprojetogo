-- Add modalidade column to fomento_parcerias
ALTER TABLE public.fomento_parcerias ADD COLUMN modalidade text;

-- Update validation trigger to include modalidade
CREATE OR REPLACE FUNCTION public.validate_fomento_parceria()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo IS NOT NULL AND NEW.tipo NOT IN ('contrato','convenio','acordo_cooperacao','termo_fomento') THEN
    RAISE EXCEPTION 'tipo must be contrato, convenio, acordo_cooperacao, termo_fomento, or NULL';
  END IF;
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('em_negociacao','ativa','encerrada','suspensa') THEN
    RAISE EXCEPTION 'status must be em_negociacao, ativa, encerrada, suspensa, or NULL';
  END IF;
  IF NEW.tipo_instituicao IS NOT NULL AND NEW.tipo_instituicao NOT IN ('publica_federal','publica_estadual','privada','internacional') THEN
    RAISE EXCEPTION 'tipo_instituicao must be publica_federal, publica_estadual, privada, internacional, or NULL';
  END IF;
  IF NEW.modalidade IS NOT NULL AND NEW.modalidade NOT IN ('bolsa','auxilio_financeiro') THEN
    RAISE EXCEPTION 'modalidade must be bolsa, auxilio_financeiro, or NULL';
  END IF;
  RETURN NEW;
END;
$function$;