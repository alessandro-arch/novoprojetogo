-- Table
CREATE TABLE public.fomento_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES fomento_projects(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'outro',
  storage_path text NOT NULL,
  tamanho_bytes integer,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_fomento_document_tipo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tipo NOT IN ('termo_outorga','termo_parceria','aditivo','relatorio_parcial',
    'relatorio_final','prestacao_contas','publicacao','outro') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_validate_fomento_document_tipo
  BEFORE INSERT OR UPDATE ON public.fomento_documents
  FOR EACH ROW EXECUTE FUNCTION validate_fomento_document_tipo();

ALTER TABLE public.fomento_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fomento_docs_select" ON public.fomento_documents
  FOR SELECT TO authenticated USING (has_fomento_access(auth.uid()));

CREATE POLICY "fomento_docs_insert" ON public.fomento_documents
  FOR INSERT TO authenticated WITH CHECK (has_fomento_access(auth.uid()));

CREATE POLICY "fomento_docs_delete" ON public.fomento_documents
  FOR DELETE TO authenticated USING (has_fomento_admin(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('fomento-docs', 'fomento-docs', false);

CREATE POLICY "fomento_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'fomento-docs' AND has_fomento_access(auth.uid()));

CREATE POLICY "fomento_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fomento-docs' AND has_fomento_access(auth.uid()));

CREATE POLICY "fomento_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'fomento-docs' AND has_fomento_admin(auth.uid()));