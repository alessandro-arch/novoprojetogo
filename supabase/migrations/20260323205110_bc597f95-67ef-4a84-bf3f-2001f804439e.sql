-- 1. Security definer functions
CREATE OR REPLACE FUNCTION public.has_fomento_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND fomento_role IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.has_fomento_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND fomento_role = 'admin'
  )
$$;

-- 2. Tables
CREATE TABLE public.fomento_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_uvv text,
  pesquisador_principal text NOT NULL,
  titulo text NOT NULL,
  edital text,
  orgao_financiador text,
  fonte text,
  natureza text,
  area text,
  tipo_servico text,
  vinculo_academico text,
  ppg_nome text,
  valor_total numeric(15,2),
  ano integer,
  data_assinatura date,
  vigencia_inicio date,
  vigencia_fim date,
  status text DEFAULT 'em_execucao',
  bolsistas_ic integer DEFAULT 0,
  bolsistas_mestrado integer DEFAULT 0,
  bolsistas_doutorado integer DEFAULT 0,
  bolsistas_pos_doc integer DEFAULT 0,
  bolsistas_extensao integer DEFAULT 0,
  extracted_by_ai boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.fomento_rubricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.fomento_projects(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.fomento_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.fomento_projects(id) ON DELETE CASCADE,
  nome text NOT NULL,
  funcao text,
  email text
);

-- 3. Validation trigger for fomento_projects
CREATE OR REPLACE FUNCTION public.validate_fomento_projects()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.fonte IS NOT NULL AND NEW.fonte NOT IN ('publica','privada') THEN
    RAISE EXCEPTION 'fonte must be publica, privada, or NULL';
  END IF;
  IF NEW.natureza IS NOT NULL AND NEW.natureza NOT IN ('outorga','parceria') THEN
    RAISE EXCEPTION 'natureza must be outorga, parceria, or NULL';
  END IF;
  IF NEW.area IS NOT NULL AND NEW.area NOT IN ('pesquisa','inovacao','extensao','servicos') THEN
    RAISE EXCEPTION 'area must be pesquisa, inovacao, extensao, servicos, or NULL';
  END IF;
  IF NEW.vinculo_academico IS NOT NULL AND NEW.vinculo_academico NOT IN ('ppg','graduacao','ambos','nenhum') THEN
    RAISE EXCEPTION 'vinculo_academico must be ppg, graduacao, ambos, nenhum, or NULL';
  END IF;
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('em_execucao','concluido','prestacao_contas','inadimplente') THEN
    RAISE EXCEPTION 'status must be em_execucao, concluido, prestacao_contas, inadimplente, or NULL';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fomento_projects
BEFORE INSERT OR UPDATE ON public.fomento_projects
FOR EACH ROW EXECUTE FUNCTION public.validate_fomento_projects();

-- 4. updated_at trigger
CREATE TRIGGER trg_fomento_projects_updated_at
BEFORE UPDATE ON public.fomento_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. RLS
ALTER TABLE public.fomento_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fomento_rubricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fomento_team ENABLE ROW LEVEL SECURITY;

-- fomento_projects policies
CREATE POLICY "fomento_projects_select" ON public.fomento_projects
FOR SELECT TO authenticated USING (public.has_fomento_access(auth.uid()));

CREATE POLICY "fomento_projects_insert" ON public.fomento_projects
FOR INSERT TO authenticated WITH CHECK (public.has_fomento_access(auth.uid()));

CREATE POLICY "fomento_projects_update" ON public.fomento_projects
FOR UPDATE TO authenticated USING (public.has_fomento_access(auth.uid()));

CREATE POLICY "fomento_projects_delete" ON public.fomento_projects
FOR DELETE TO authenticated USING (public.has_fomento_admin(auth.uid()));

-- fomento_rubricas policies
CREATE POLICY "fomento_rubricas_all" ON public.fomento_rubricas
FOR ALL TO authenticated USING (public.has_fomento_access(auth.uid()));

-- fomento_team policies
CREATE POLICY "fomento_team_all" ON public.fomento_team
FOR ALL TO authenticated USING (public.has_fomento_access(auth.uid()));