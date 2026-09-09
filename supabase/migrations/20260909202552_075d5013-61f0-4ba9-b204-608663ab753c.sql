CREATE TABLE public.fomento_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.fomento_organizations(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  meta_captacao numeric NOT NULL DEFAULT 0,
  meta_projetos integer NOT NULL DEFAULT 0,
  meta_bolsas integer NOT NULL DEFAULT 0,
  meta_pesquisadores integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fomento_metas TO authenticated;
GRANT ALL ON public.fomento_metas TO service_role;

ALTER TABLE public.fomento_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY fomento_metas_select ON public.fomento_metas FOR SELECT TO authenticated USING (has_fomento_access(auth.uid()));
CREATE POLICY fomento_metas_insert ON public.fomento_metas FOR INSERT TO authenticated WITH CHECK (has_fomento_write_access(auth.uid()));
CREATE POLICY fomento_metas_update ON public.fomento_metas FOR UPDATE TO authenticated USING (has_fomento_write_access(auth.uid())) WITH CHECK (has_fomento_write_access(auth.uid()));
CREATE POLICY fomento_metas_delete ON public.fomento_metas FOR DELETE TO authenticated USING (has_fomento_admin(auth.uid()));

CREATE TRIGGER update_fomento_metas_updated_at BEFORE UPDATE ON public.fomento_metas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();