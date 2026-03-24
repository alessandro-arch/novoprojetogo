-- Backfill organization_id for existing fomento_projects that have NULL
UPDATE fomento_projects 
SET organization_id = '876b22bb-8500-4b77-8e8a-d9c0cc04dd48'
WHERE organization_id IS NULL;

-- Backfill processo_uvv for existing projects
DO $$
DECLARE
  r RECORD;
  _processo TEXT;
BEGIN
  FOR r IN SELECT id FROM fomento_projects WHERE processo_uvv IS NULL ORDER BY created_at
  LOOP
    SELECT generate_fomento_processo('876b22bb-8500-4b77-8e8a-d9c0cc04dd48') INTO _processo;
    UPDATE fomento_projects SET processo_uvv = _processo WHERE id = r.id;
  END LOOP;
END;
$$;

-- Also backfill fomento_org_id for users with fomento_role but no org assigned
UPDATE profiles 
SET fomento_org_id = '876b22bb-8500-4b77-8e8a-d9c0cc04dd48'
WHERE fomento_role IS NOT NULL AND fomento_org_id IS NULL;