
-- Create fomento_parcerias table
CREATE TABLE public.fomento_parcerias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.fomento_organizations(id),
  numero_contrato text,
  titulo text NOT NULL,
  tipo text,
  status text DEFAULT 'em_negociacao',
  instituicao_nome text,
  cnpj text,
  tipo_instituicao text,
  num_beneficiarios integer DEFAULT 0,
  num_parcelas integer DEFAULT 0,
  valor_mensal_aluno numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.fomento_parcerias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fomento_parcerias_select" ON public.fomento_parcerias
  FOR SELECT TO authenticated USING (has_fomento_access(auth.uid()));

CREATE POLICY "fomento_parcerias_insert" ON public.fomento_parcerias
  FOR INSERT TO authenticated WITH CHECK (has_fomento_access(auth.uid()));

CREATE POLICY "fomento_parcerias_update" ON public.fomento_parcerias
  FOR UPDATE TO authenticated USING (has_fomento_access(auth.uid()));

CREATE POLICY "fomento_parcerias_delete" ON public.fomento_parcerias
  FOR DELETE TO authenticated USING (has_fomento_admin(auth.uid()));

-- updated_at trigger
CREATE TRIGGER fomento_parcerias_updated_at
  BEFORE UPDATE ON public.fomento_parcerias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_fomento_parceria()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER fomento_parcerias_validate
  BEFORE INSERT OR UPDATE ON public.fomento_parcerias
  FOR EACH ROW EXECUTE FUNCTION validate_fomento_parceria();
