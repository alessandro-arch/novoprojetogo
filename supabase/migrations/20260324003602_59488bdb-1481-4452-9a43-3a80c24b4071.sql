
-- Table: fomento_bolsistas
CREATE TABLE public.fomento_bolsistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.fomento_organizations(id),
  project_id uuid REFERENCES public.fomento_projects(id),
  nome_bolsista text NOT NULL,
  email_bolsista text,
  cpf_bolsista text,
  modalidade text,
  orientador text,
  coorientador text,
  coordenador text,
  edital text,
  orgao_financiador text,
  numero_termo text,
  cotas_total integer,
  data_inicio date,
  data_fim date,
  valor_mensal numeric(10,2),
  valor_total numeric(10,2) GENERATED ALWAYS AS (cotas_total * valor_mensal) STORED,
  status text DEFAULT 'ativo',
  ppg_nome text,
  titulo_plano text,
  area_conhecimento text,
  extracted_by_ai boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_fomento_bolsista()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.modalidade IS NOT NULL AND NEW.modalidade NOT IN ('ic','mestrado','doutorado','pos_doc','apoio_tecnico','extensao') THEN
    RAISE EXCEPTION 'modalidade must be ic, mestrado, doutorado, pos_doc, apoio_tecnico, extensao, or NULL';
  END IF;
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('ativo','suspenso','cancelado','concluido') THEN
    RAISE EXCEPTION 'status must be ativo, suspenso, cancelado, concluido, or NULL';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fomento_bolsista
  BEFORE INSERT OR UPDATE ON public.fomento_bolsistas
  FOR EACH ROW EXECUTE FUNCTION public.validate_fomento_bolsista();

-- updated_at trigger
CREATE TRIGGER trg_fomento_bolsistas_updated_at
  BEFORE UPDATE ON public.fomento_bolsistas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.fomento_bolsistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY fomento_bolsistas_select ON public.fomento_bolsistas
  FOR SELECT TO authenticated USING (public.has_fomento_access(auth.uid()));

CREATE POLICY fomento_bolsistas_insert ON public.fomento_bolsistas
  FOR INSERT TO authenticated WITH CHECK (public.has_fomento_access(auth.uid()));

CREATE POLICY fomento_bolsistas_update ON public.fomento_bolsistas
  FOR UPDATE TO authenticated USING (public.has_fomento_access(auth.uid()));

CREATE POLICY fomento_bolsistas_delete ON public.fomento_bolsistas
  FOR DELETE TO authenticated USING (public.has_fomento_admin(auth.uid()));
