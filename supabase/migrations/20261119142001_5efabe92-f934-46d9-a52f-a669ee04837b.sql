CREATE TABLE public.sd_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment text NOT NULL,
  full_name text NOT NULL,
  email text,
  department text,
  status text NOT NULL DEFAULT 'ativo',
  service_desk_access_active boolean NOT NULL DEFAULT true,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, enrollment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sd_staff TO authenticated;
GRANT ALL ON public.sd_staff TO service_role;
ALTER TABLE public.sd_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY adm ON public.sd_staff FOR ALL TO authenticated
  USING (sd_is_admin(auth.uid(), organization_id)) WITH CHECK (sd_is_admin(auth.uid(), organization_id));
CREATE POLICY sel ON public.sd_staff FOR SELECT TO authenticated
  USING (sd_is_admin(auth.uid(), organization_id) OR sd_has_role(auth.uid(), organization_id, 'operador') OR user_id = auth.uid());
CREATE TRIGGER sd_staff_updated BEFORE UPDATE ON public.sd_staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sd_is_self_person(_user_id uuid, _org_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM sd_students WHERE user_id=_user_id AND organization_id=_org_id)
      OR EXISTS (SELECT 1 FROM sd_faculty WHERE user_id=_user_id AND organization_id=_org_id)
      OR EXISTS (SELECT 1 FROM sd_staff WHERE user_id=_user_id AND organization_id=_org_id)
$$;

CREATE OR REPLACE FUNCTION public.sd_me()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s record; f record; t record;
BEGIN
  SELECT st.*, p.name AS program_name INTO s FROM sd_students st LEFT JOIN sd_programs p ON p.id=st.program_id WHERE st.user_id=auth.uid() LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('kind','aluno','org',s.organization_id,'name',s.full_name,'enrollment',s.enrollment,'email',s.email,'program',s.program_name,
    'can_request', s.status <> 'trancado' AND s.service_desk_access_active); END IF;
  SELECT * INTO f FROM sd_faculty WHERE user_id=auth.uid() LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('kind','professor','org',f.organization_id,'name',f.full_name,'enrollment',f.enrollment,'email',f.personal_email,
    'program',(SELECT string_agg(COALESCE(p.sigla,p.name), ', ') FROM sd_faculty_programs fp JOIN sd_programs p ON p.id=fp.program_id WHERE fp.faculty_id=f.id),
    'can_request', f.status='ativo'); END IF;
  SELECT * INTO t FROM sd_staff WHERE user_id=auth.uid() LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('kind','tecnico','org',t.organization_id,'name',t.full_name,'enrollment',t.enrollment,'email',t.email,'program',t.department,
    'can_request', t.status='ativo' AND t.service_desk_access_active); END IF;
  RETURN NULL;
END $$;