ALTER TABLE public.sd_faculty ADD COLUMN IF NOT EXISTS personal_email text, ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.sd_is_self_person(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM sd_students WHERE user_id=_user_id AND organization_id=_org_id)
      OR EXISTS (SELECT 1 FROM sd_faculty WHERE user_id=_user_id AND organization_id=_org_id)
$$;
CREATE OR REPLACE FUNCTION public.sd_is_advisor_of(_user_id uuid, _advisor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM sd_faculty WHERE id=_advisor_id AND user_id=_user_id)
$$;
CREATE OR REPLACE FUNCTION public.sd_is_faculty_self(_user_id uuid, _faculty_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM sd_faculty WHERE id=_faculty_id AND user_id=_user_id)
$$;

CREATE POLICY self_sel ON public.sd_programs FOR SELECT TO authenticated USING (sd_is_self_person(auth.uid(), organization_id));
CREATE POLICY self_sel ON public.sd_faculty_programs FOR SELECT TO authenticated USING (sd_is_faculty_self(auth.uid(), faculty_id));
CREATE POLICY advisor_sel ON public.sd_students FOR SELECT TO authenticated USING (advisor_id IS NOT NULL AND sd_is_advisor_of(auth.uid(), advisor_id));
CREATE POLICY advisee_sel ON public.sd_faculty FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sd_students s WHERE s.advisor_id = sd_faculty.id AND s.user_id = auth.uid()));
CREATE POLICY group_member_sel ON public.sd_groups FOR SELECT TO authenticated USING (sd_in_group(auth.uid(), id));

CREATE TABLE public.sd_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, description text, terms_text text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sd_services TO authenticated;
GRANT ALL ON public.sd_services TO service_role;
ALTER TABLE public.sd_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.sd_services FOR SELECT TO authenticated USING (sd_is_member(auth.uid(), organization_id) OR sd_is_superadmin(auth.uid()) OR sd_is_self_person(auth.uid(), organization_id));
CREATE POLICY adm ON public.sd_services FOR ALL TO authenticated USING (sd_is_admin(auth.uid(), organization_id)) WITH CHECK (sd_is_admin(auth.uid(), organization_id));
CREATE TRIGGER upd BEFORE UPDATE ON public.sd_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.sd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.sd_services(id),
  requester_user_id uuid NOT NULL,
  requester_kind text NOT NULL,
  requester_name text NOT NULL, requester_enrollment text NOT NULL,
  requester_email text, requester_program text,
  status text NOT NULL DEFAULT 'em_analise',
  step_index int NOT NULL DEFAULT 0,
  current_group_id uuid REFERENCES public.sd_groups(id),
  terms_hash text, terms_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sd_requests TO authenticated;
GRANT ALL ON public.sd_requests TO service_role;
ALTER TABLE public.sd_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.sd_requests FOR SELECT TO authenticated USING (
  requester_user_id = auth.uid() OR sd_is_admin(auth.uid(), organization_id)
  OR EXISTS (SELECT 1 FROM sd_services sv CROSS JOIN LATERAL jsonb_array_elements_text(sv.steps) AS g(code)
             JOIN sd_groups gr ON gr.code = g.code AND gr.organization_id = sv.organization_id
             WHERE sv.id = sd_requests.service_id AND sd_in_group(auth.uid(), gr.id)));
CREATE TRIGGER upd BEFORE UPDATE ON public.sd_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.sd_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.sd_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  actor_user_id uuid, actor_name text, action text NOT NULL, note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sd_request_events TO authenticated;
GRANT ALL ON public.sd_request_events TO service_role;
ALTER TABLE public.sd_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.sd_request_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sd_requests r WHERE r.id = request_id));

CREATE TABLE public.sd_divergences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, person_kind text NOT NULL, person_name text, enrollment text,
  field text NOT NULL, description text NOT NULL,
  status text NOT NULL DEFAULT 'aberta', resolution_note text,
  resolved_by uuid, resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sd_divergences TO authenticated;
GRANT ALL ON public.sd_divergences TO service_role;
ALTER TABLE public.sd_divergences ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.sd_divergences FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR sd_is_admin(auth.uid(), organization_id)
  OR EXISTS (SELECT 1 FROM sd_groups g WHERE g.organization_id = sd_divergences.organization_id AND g.code='PRPPGE' AND sd_in_group(auth.uid(), g.id)));

-- Person lookup
CREATE OR REPLACE FUNCTION public.sd_me()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; f record;
BEGIN
  SELECT st.*, p.name AS program_name INTO s FROM sd_students st LEFT JOIN sd_programs p ON p.id=st.program_id WHERE st.user_id=auth.uid() LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('kind','aluno','org',s.organization_id,'name',s.full_name,'enrollment',s.enrollment,'email',s.email,'program',s.program_name,
    'can_request', s.status <> 'trancado' AND s.service_desk_access_active); END IF;
  SELECT * INTO f FROM sd_faculty WHERE user_id=auth.uid() LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('kind','professor','org',f.organization_id,'name',f.full_name,'enrollment',f.enrollment,'email',f.personal_email,
    'program',(SELECT string_agg(COALESCE(p.sigla,p.name), ', ') FROM sd_faculty_programs fp JOIN sd_programs p ON p.id=fp.program_id WHERE fp.faculty_id=f.id),
    'can_request', f.status='ativo'); END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sd_update_my_contact(_email text, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _email IS NOT NULL AND _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'e-mail inválido'; END IF;
  UPDATE sd_students SET email=lower(btrim(_email)), phone=regexp_replace(COALESCE(_phone,''),'\D','','g') WHERE user_id=auth.uid();
  UPDATE sd_faculty SET personal_email=lower(btrim(_email)), phone=regexp_replace(COALESCE(_phone,''),'\D','','g') WHERE user_id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.sd_report_divergence(_field text, _description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me jsonb; _id uuid;
BEGIN
  me := sd_me();
  IF me IS NULL THEN RAISE EXCEPTION 'Sem vínculo'; END IF;
  IF length(btrim(COALESCE(_description,''))) < 5 OR length(_description) > 2000 THEN RAISE EXCEPTION 'descrição inválida'; END IF;
  INSERT INTO sd_divergences(organization_id,user_id,person_kind,person_name,enrollment,field,description)
  VALUES ((me->>'org')::uuid, auth.uid(), me->>'kind', me->>'name', me->>'enrollment', left(_field,100), _description) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.sd_resolve_divergence(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d record;
BEGIN
  SELECT * INTO d FROM sd_divergences WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'não encontrada'; END IF;
  IF NOT (sd_is_admin(auth.uid(), d.organization_id) OR EXISTS (SELECT 1 FROM sd_groups g WHERE g.organization_id=d.organization_id AND g.code='PRPPGE' AND sd_in_group(auth.uid(), g.id))) THEN
    RAISE EXCEPTION 'sem permissão'; END IF;
  UPDATE sd_divergences SET status='resolvida', resolution_note=_note, resolved_by=auth.uid(), resolved_at=now() WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.sd_create_request(_service_id uuid, _terms_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me jsonb; sv record; _gid uuid; _id uuid;
BEGIN
  me := sd_me();
  IF me IS NULL THEN RAISE EXCEPTION 'Sem vínculo'; END IF;
  IF NOT (me->>'can_request')::boolean THEN RAISE EXCEPTION 'Seu acesso está suspenso'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=_service_id AND organization_id=(me->>'org')::uuid AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'serviço indisponível'; END IF;
  IF EXISTS (SELECT 1 FROM sd_requests WHERE requester_user_id=auth.uid() AND service_id=_service_id AND status IN ('em_analise','aprovado','em_andamento')) THEN
    RAISE EXCEPTION 'Você já tem uma solicitação em aberto para este serviço'; END IF;
  IF _terms_hash IS NULL OR _terms_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'termo não aceito'; END IF;
  SELECT id INTO _gid FROM sd_groups WHERE organization_id=sv.organization_id AND code=(sv.steps->>0);
  INSERT INTO sd_requests(organization_id,service_id,requester_user_id,requester_kind,requester_name,requester_enrollment,requester_email,requester_program,current_group_id,terms_hash,terms_accepted_at)
  VALUES (sv.organization_id,sv.id,auth.uid(),me->>'kind',me->>'name',me->>'enrollment',me->>'email',me->>'program',_gid,_terms_hash,now()) RETURNING id INTO _id;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action) VALUES (_id,sv.organization_id,auth.uid(),me->>'name','criada');
  RETURN _id;
END $$;

-- _action: aprovar | iniciar | concluir | recusar
CREATE OR REPLACE FUNCTION public.sd_advance_request(_id uuid, _action text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; sv record; _next uuid; _last boolean; _actor text;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'não encontrada'; END IF;
  IF r.status IN ('concluido','recusado') THEN RAISE EXCEPTION 'solicitação já encerrada'; END IF;
  IF NOT (sd_is_admin(auth.uid(), r.organization_id) OR (r.current_group_id IS NOT NULL AND sd_in_group(auth.uid(), r.current_group_id))) THEN
    RAISE EXCEPTION 'sem permissão nesta etapa'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=r.service_id;
  _last := r.step_index >= jsonb_array_length(sv.steps)-1;
  SELECT full_name INTO _actor FROM profiles WHERE user_id=auth.uid();
  IF _action='recusar' THEN
    IF length(btrim(COALESCE(_note,'')))<3 THEN RAISE EXCEPTION 'informe o motivo'; END IF;
    UPDATE sd_requests SET status='recusado' WHERE id=_id;
  ELSIF _action='aprovar' AND NOT _last THEN
    SELECT id INTO _next FROM sd_groups WHERE organization_id=r.organization_id AND code=(sv.steps->>(r.step_index+1));
    UPDATE sd_requests SET status='aprovado', step_index=step_index+1, current_group_id=_next WHERE id=_id;
  ELSIF _action='iniciar' AND _last THEN
    UPDATE sd_requests SET status='em_andamento' WHERE id=_id;
  ELSIF _action='concluir' AND _last THEN
    UPDATE sd_requests SET status='concluido' WHERE id=_id;
  ELSE RAISE EXCEPTION 'ação inválida nesta etapa'; END IF;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,note) VALUES (_id,r.organization_id,auth.uid(),_actor,_action,_note);
END $$;

REVOKE EXECUTE ON FUNCTION public.sd_me(), public.sd_update_my_contact(text,text), public.sd_report_divergence(text,text), public.sd_resolve_divergence(uuid,text), public.sd_create_request(uuid,text), public.sd_advance_request(uuid,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sd_me(), public.sd_update_my_contact(text,text), public.sd_report_divergence(text,text), public.sd_resolve_divergence(uuid,text), public.sd_create_request(uuid,text), public.sd_advance_request(uuid,text,text) TO authenticated;

INSERT INTO public.sd_services(organization_id, code, name, description, terms_text, steps)
SELECT id, 'VPN_CAPES', 'Acesso VPN — Portal de Periódicos CAPES',
 'Acesso remoto ao Portal de Periódicos CAPES pela VPN institucional.',
 'Declaro que utilizarei o acesso VPN exclusivamente para fins acadêmicos e de pesquisa, que não compartilharei minhas credenciais com terceiros e que respeitarei as regras de uso do Portal de Periódicos CAPES e da instituição. Estou ciente de que o acesso poderá ser revogado em caso de uso indevido ou de encerramento do meu vínculo.',
 '["PRPPGE","DTI"]'::jsonb
FROM public.organizations WHERE sigla='UVV'
ON CONFLICT DO NOTHING;