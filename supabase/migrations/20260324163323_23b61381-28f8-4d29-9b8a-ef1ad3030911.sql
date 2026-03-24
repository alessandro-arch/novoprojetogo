
-- 1. Create has_fomento_write_access function (excludes auditor)
CREATE OR REPLACE FUNCTION public.has_fomento_write_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND fomento_role IN ('superadmin', 'admin', 'gestor')
  )
$$;

-- 2. Update validate_fomento_role to accept 'auditor'
CREATE OR REPLACE FUNCTION public.validate_fomento_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fomento_role IS NOT NULL 
     AND NEW.fomento_role NOT IN ('superadmin', 'admin', 'gestor', 'auditor') THEN
    RAISE EXCEPTION 'fomento_role must be superadmin, admin, gestor, auditor, or NULL';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Update set_fomento_role to accept 'auditor'
CREATE OR REPLACE FUNCTION public.set_fomento_role(_target_user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_fomento_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only fomento admins can manage roles';
  END IF;
  IF _role IS NOT NULL AND _role NOT IN ('superadmin', 'admin', 'gestor', 'auditor') THEN
    RAISE EXCEPTION 'Role must be superadmin, admin, gestor, auditor, or NULL';
  END IF;
  UPDATE public.profiles SET fomento_role = _role WHERE user_id = _target_user_id;
END;
$function$;

-- 4. Update RLS: fomento_projects INSERT/UPDATE use write_access
DROP POLICY IF EXISTS "fomento_projects_insert" ON public.fomento_projects;
CREATE POLICY "fomento_projects_insert" ON public.fomento_projects
  FOR INSERT TO authenticated
  WITH CHECK (has_fomento_write_access(auth.uid()));

DROP POLICY IF EXISTS "fomento_projects_update" ON public.fomento_projects;
CREATE POLICY "fomento_projects_update" ON public.fomento_projects
  FOR UPDATE TO authenticated
  USING (has_fomento_write_access(auth.uid()));

-- 5. Update RLS: fomento_bolsistas INSERT/UPDATE use write_access
DROP POLICY IF EXISTS "fomento_bolsistas_insert" ON public.fomento_bolsistas;
CREATE POLICY "fomento_bolsistas_insert" ON public.fomento_bolsistas
  FOR INSERT TO authenticated
  WITH CHECK (has_fomento_write_access(auth.uid()));

DROP POLICY IF EXISTS "fomento_bolsistas_update" ON public.fomento_bolsistas;
CREATE POLICY "fomento_bolsistas_update" ON public.fomento_bolsistas
  FOR UPDATE TO authenticated
  USING (has_fomento_write_access(auth.uid()));

-- 6. Update RLS: fomento_parcerias INSERT/UPDATE use write_access
DROP POLICY IF EXISTS "fomento_parcerias_insert" ON public.fomento_parcerias;
CREATE POLICY "fomento_parcerias_insert" ON public.fomento_parcerias
  FOR INSERT TO authenticated
  WITH CHECK (has_fomento_write_access(auth.uid()));

DROP POLICY IF EXISTS "fomento_parcerias_update" ON public.fomento_parcerias;
CREATE POLICY "fomento_parcerias_update" ON public.fomento_parcerias
  FOR UPDATE TO authenticated
  USING (has_fomento_write_access(auth.uid()));

-- 7. Update RLS: fomento_documents INSERT use write_access
DROP POLICY IF EXISTS "fomento_docs_insert" ON public.fomento_documents;
CREATE POLICY "fomento_docs_insert" ON public.fomento_documents
  FOR INSERT TO authenticated
  WITH CHECK (has_fomento_write_access(auth.uid()));

-- 8. Split fomento_rubricas_all into SELECT + write policies
DROP POLICY IF EXISTS "fomento_rubricas_all" ON public.fomento_rubricas;

CREATE POLICY "fomento_rubricas_select" ON public.fomento_rubricas
  FOR SELECT TO authenticated
  USING (has_fomento_access(auth.uid()));

CREATE POLICY "fomento_rubricas_insert" ON public.fomento_rubricas
  FOR INSERT TO authenticated
  WITH CHECK (has_fomento_write_access(auth.uid()));

CREATE POLICY "fomento_rubricas_update" ON public.fomento_rubricas
  FOR UPDATE TO authenticated
  USING (has_fomento_write_access(auth.uid()));

CREATE POLICY "fomento_rubricas_delete" ON public.fomento_rubricas
  FOR DELETE TO authenticated
  USING (has_fomento_write_access(auth.uid()));

-- 9. Split fomento_team_all into SELECT + write policies
DROP POLICY IF EXISTS "fomento_team_all" ON public.fomento_team;

CREATE POLICY "fomento_team_select" ON public.fomento_team
  FOR SELECT TO authenticated
  USING (has_fomento_access(auth.uid()));

CREATE POLICY "fomento_team_insert" ON public.fomento_team
  FOR INSERT TO authenticated
  WITH CHECK (has_fomento_write_access(auth.uid()));

CREATE POLICY "fomento_team_update" ON public.fomento_team
  FOR UPDATE TO authenticated
  USING (has_fomento_write_access(auth.uid()));

CREATE POLICY "fomento_team_delete" ON public.fomento_team
  FOR DELETE TO authenticated
  USING (has_fomento_write_access(auth.uid()));
