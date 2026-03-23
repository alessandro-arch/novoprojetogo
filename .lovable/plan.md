

## Plan: Add Document Management to Fomento Projects

### Summary
Add a [G] Documents section to the project form with file upload, a new `fomento_documents` table, a private storage bucket, document counter in the project list, and a KPI on the dashboard.

### Step 1: Database Migration

Create `fomento_documents` table and `fomento-docs` storage bucket:

```sql
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

-- Validation trigger (instead of CHECK constraint)
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
```

### Step 2: Add [G] Documents Section to `FomentoProjectForm.tsx`

After the `[F] Vigência & Status` section (line 616), add a new `SectionCard` with id `"docs"`:

- Add `docs: true` to `openSections` initial state
- Query `fomento_documents` for the current `projectId`
- **Upload zone**: Dropzone accepting PDFs (drag & drop + click), multiple files
- **Per-file form**: Name (pre-filled from filename), Type select (8 options), Description (optional)
- **Progress bar** using the `Progress` component during upload
- Upload flow: `supabase.storage.from('fomento-docs').upload(path, file)` where path = `{org_id}/{project_id}/{filename}`
- After upload, insert row into `fomento_documents`
- **Existing documents list**: Icon + name + type badge + size + date + uploader
- Action buttons: View (signed URL, new tab), Download (signed URL with download disposition), Delete (AlertDialog confirmation)
- Note: Documents section only shows when editing (needs `projectId`)

### Step 3: Add "Docs" Column to `FomentoProjectsList.tsx`

- Add a query for document counts: `SELECT project_id, count(*) FROM fomento_documents GROUP BY project_id`
- Add column "Docs" after "Valor Total" showing `📎 N` badge
- Zero docs shows `—`

### Step 4: Add "Total de Documentos" KPI to `FomentoDashboardView.tsx`

- Query `fomento_documents` count
- Add 5th KPI card: icon `FileText`, label "Total de Documentos", value = count
- Adjust grid from `lg:grid-cols-4` to `lg:grid-cols-5`

### Technical Details

- **Files modified**: `FomentoProjectForm.tsx`, `FomentoProjectsList.tsx`, `FomentoDashboardView.tsx`
- **New migration**: Creates table, trigger, RLS policies, storage bucket + policies
- **Storage path convention**: `fomento-docs/{organization_id}/{project_id}/{filename}`
- **Signed URLs**: Used for view/download since bucket is private; generated via `supabase.storage.from('fomento-docs').createSignedUrl(path, 3600)`
- **Type labels map**: `{ termo_outorga: "Termo de Outorga", ... }` added to `fomento-utils.ts`
- **File size formatting**: Helper to show KB/MB

