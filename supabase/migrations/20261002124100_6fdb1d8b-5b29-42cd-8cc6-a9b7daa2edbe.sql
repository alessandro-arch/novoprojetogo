ALTER TABLE public.sd_services ADD COLUMN IF NOT EXISTS form_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.sd_services SET form_fields = '[{"key":"finalidade","label":"Finalidade do acesso","type":"textarea","required":true}]'::jsonb WHERE form_fields = '[]'::jsonb;

ALTER TABLE public.sd_requests
  ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS correction_cycle int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correction_fields text[],
  ADD COLUMN IF NOT EXISTS correction_note text,
  ADD COLUMN IF NOT EXISTS correction_requested_by text,
  ADD COLUMN IF NOT EXISTS correction_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_return_group_id uuid,
  ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz;

CREATE TABLE public.sd_request_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.sd_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  cycle int NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sd_request_versions TO authenticated;
GRANT ALL ON public.sd_request_versions TO service_role;
ALTER TABLE public.sd_request_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sd_versions_select ON public.sd_request_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sd_requests r WHERE r.id = request_id));
CREATE INDEX sd_request_versions_req_idx ON public.sd_request_versions(request_id, cycle);

-- Criar solicitação com respostas declaratórias
CREATE OR REPLACE FUNCTION public.sd_create_request(_service_id uuid, _terms_hash text, _form jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me jsonb; sv record; _gid uuid; _id uuid; f jsonb; _clean jsonb := '{}'::jsonb; _v text;
BEGIN
  me := sd_me();
  IF me IS NULL THEN RAISE EXCEPTION 'Sem vínculo'; END IF;
  IF NOT (me->>'can_request')::boolean THEN RAISE EXCEPTION 'Seu acesso está suspenso'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=_service_id AND organization_id=(me->>'org')::uuid AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'serviço indisponível'; END IF;
  IF EXISTS (SELECT 1 FROM sd_requests WHERE requester_user_id=auth.uid() AND service_id=_service_id AND status IN ('em_analise','aprovado','em_andamento','correcao')) THEN
    RAISE EXCEPTION 'Você já tem uma solicitação em aberto para este serviço'; END IF;
  IF _terms_hash IS NULL OR _terms_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'termo não aceito'; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(sv.form_fields) LOOP
    _v := btrim(COALESCE(_form->>(f->>'key'),''));
    IF length(_v) > 4000 THEN RAISE EXCEPTION 'texto muito longo em %', f->>'label'; END IF;
    IF COALESCE((f->>'required')::boolean,false) AND length(_v) < 3 THEN RAISE EXCEPTION 'preencha: %', f->>'label'; END IF;
    _clean := _clean || jsonb_build_object(f->>'key', _v);
  END LOOP;
  SELECT id INTO _gid FROM sd_groups WHERE organization_id=sv.organization_id AND code=(sv.steps->>0);
  INSERT INTO sd_requests(organization_id,service_id,requester_user_id,requester_kind,requester_name,requester_enrollment,requester_email,requester_program,current_group_id,terms_hash,terms_accepted_at,form_data)
  VALUES (sv.organization_id,sv.id,auth.uid(),me->>'kind',me->>'name',me->>'enrollment',me->>'email',me->>'program',_gid,_terms_hash,now(),_clean) RETURNING id INTO _id;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,to_group_id) VALUES (_id,sv.organization_id,auth.uid(),me->>'name','criada',_gid);
  RETURN _id;
END $function$;
DROP FUNCTION IF EXISTS public.sd_create_request(uuid, text);

-- Grupo solicita correção (um ou mais campos declaratórios + motivo)
CREATE OR REPLACE FUNCTION public.sd_request_correction(_id uuid, _fields text[], _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; sv record; _actor text; _labels text; _bad text;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'não encontrada'; END IF;
  IF r.status NOT IN ('em_analise','aprovado','em_andamento') OR r.current_group_id IS NULL THEN RAISE EXCEPTION 'esta solicitação não pode receber correção agora'; END IF;
  IF NOT (sd_is_admin(auth.uid(), r.organization_id) OR sd_in_group(auth.uid(), r.current_group_id)) THEN RAISE EXCEPTION 'sem permissão nesta etapa'; END IF;
  IF length(btrim(COALESCE(_note,''))) < 3 THEN RAISE EXCEPTION 'informe o motivo da correção'; END IF;
  IF _fields IS NULL OR array_length(_fields,1) IS NULL THEN RAISE EXCEPTION 'selecione ao menos um campo'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=r.service_id;
  SELECT string_agg(x,', ') INTO _bad FROM unnest(_fields) x WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(sv.form_fields) f WHERE f->>'key'=x);
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'campo não corrigível: %', _bad; END IF;
  SELECT string_agg(f->>'label', ', ') INTO _labels FROM jsonb_array_elements(sv.form_fields) f WHERE f->>'key' = ANY(_fields);
  SELECT full_name INTO _actor FROM profiles WHERE user_id=auth.uid();
  UPDATE sd_requests SET status='correcao', correction_cycle=correction_cycle+1, correction_fields=_fields, correction_note=btrim(_note),
    correction_requested_by=COALESCE(_actor,'Equipe'), correction_requested_at=now(), correction_return_group_id=r.current_group_id, current_group_id=NULL
  WHERE id=_id;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,note,from_group_id,to_group_id)
    VALUES (_id,r.organization_id,auth.uid(),_actor,'corrigir','Correção #'||(r.correction_cycle+1)||' · Campo: '||_labels||' · Motivo: '||btrim(_note),r.current_group_id,NULL);
END $function$;

-- Solicitante reenvia (somente campos indicados; versiona antes de salvar)
CREATE OR REPLACE FUNCTION public.sd_resubmit_request(_id uuid, _form jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; sv record; k text; _old text; _new text; _lbl text; _changed int := 0;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.requester_user_id <> auth.uid() THEN RAISE EXCEPTION 'não encontrada'; END IF;
  IF r.status <> 'correcao' THEN RAISE EXCEPTION 'esta solicitação não está aguardando correção'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=r.service_id;
  FOREACH k IN ARRAY r.correction_fields LOOP
    SELECT f->>'label' INTO _lbl FROM jsonb_array_elements(sv.form_fields) f WHERE f->>'key'=k;
    _old := r.form_data->>k;
    _new := btrim(COALESCE(_form->>k,''));
    IF length(_new) < 3 THEN RAISE EXCEPTION 'preencha: %', COALESCE(_lbl,k); END IF;
    IF length(_new) > 4000 THEN RAISE EXCEPTION 'texto muito longo em %', COALESCE(_lbl,k); END IF;
    IF _new IS DISTINCT FROM _old THEN _changed := _changed + 1; END IF;
    INSERT INTO sd_request_versions(request_id,organization_id,cycle,field,old_value,new_value,changed_by)
      VALUES (_id,r.organization_id,r.correction_cycle,k,_old,_new,auth.uid());
    r.form_data := r.form_data || jsonb_build_object(k,_new);
  END LOOP;
  IF _changed = 0 THEN RAISE EXCEPTION 'altere ao menos um dos campos indicados antes de reenviar'; END IF;
  UPDATE sd_requests SET form_data=r.form_data, status=CASE WHEN step_index=0 THEN 'em_analise' ELSE 'aprovado' END,
    current_group_id=r.correction_return_group_id, resubmitted_at=now()
  WHERE id=_id;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,note,from_group_id,to_group_id)
    VALUES (_id,r.organization_id,auth.uid(),r.requester_name,'reenviar','Correção #'||r.correction_cycle||' reenviada',NULL,r.correction_return_group_id);
END $function$;

-- sd_advance_request: correção agora tem função própria
CREATE OR REPLACE FUNCTION public.sd_advance_request(_id uuid, _action text, _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; sv record; _next uuid; _last boolean; _actor text; _to uuid;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'não encontrada'; END IF;
  IF r.status IN ('concluido','recusado') THEN RAISE EXCEPTION 'solicitação já encerrada'; END IF;
  IF r.status = 'correcao' THEN RAISE EXCEPTION 'aguardando correção do solicitante'; END IF;
  IF NOT (sd_is_admin(auth.uid(), r.organization_id) OR (r.current_group_id IS NOT NULL AND sd_in_group(auth.uid(), r.current_group_id))) THEN
    RAISE EXCEPTION 'sem permissão nesta etapa'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=r.service_id;
  _last := r.step_index >= jsonb_array_length(sv.steps)-1;
  SELECT full_name INTO _actor FROM profiles WHERE user_id=auth.uid();
  _to := r.current_group_id;
  IF _action='recusar' THEN
    IF length(btrim(COALESCE(_note,'')))<3 THEN RAISE EXCEPTION 'informe o motivo'; END IF;
    UPDATE sd_requests SET status='recusado' WHERE id=_id; _to := NULL;
  ELSIF _action='aprovar' AND NOT _last THEN
    SELECT id INTO _next FROM sd_groups WHERE organization_id=r.organization_id AND code=(sv.steps->>(r.step_index+1));
    UPDATE sd_requests SET status='aprovado', step_index=step_index+1, current_group_id=_next WHERE id=_id; _to := _next;
  ELSIF _action='iniciar' AND _last THEN
    UPDATE sd_requests SET status='em_andamento' WHERE id=_id;
  ELSIF _action='concluir' AND _last THEN
    UPDATE sd_requests SET status='concluido' WHERE id=_id; _to := NULL;
  ELSE RAISE EXCEPTION 'ação inválida nesta etapa'; END IF;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,note,from_group_id,to_group_id)
    VALUES (_id,r.organization_id,auth.uid(),_actor,_action,_note,r.current_group_id,_to);
END $function$;

-- Notificações internas: correção para o solicitante; reenvio para o grupo
CREATE OR REPLACE FUNCTION public.sd_event_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; _svc text; _lbl text;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=NEW.request_id;
  SELECT name INTO _svc FROM sd_services WHERE id=r.service_id;
  _lbl := CASE NEW.action WHEN 'criada' THEN 'Solicitação enviada' WHEN 'aprovar' THEN 'Solicitação autorizada'
    WHEN 'iniciar' THEN 'Execução iniciada' WHEN 'concluir' THEN 'Solicitação concluída' WHEN 'recusar' THEN 'Solicitação indeferida'
    WHEN 'corrigir' THEN 'Ação necessária: correção solicitada' WHEN 'reenviar' THEN 'Correção reenviada' ELSE NEW.action END;
  INSERT INTO sd_notifications(organization_id,user_id,request_id,title,body)
    VALUES (r.organization_id, r.requester_user_id, r.id, _lbl||' — '||COALESCE(_svc,''), r.protocol||COALESCE(' · '||NEW.note,''));
  IF NEW.to_group_id IS NOT NULL AND NEW.action IN ('criada','aprovar','reenviar') THEN
    INSERT INTO sd_notifications(organization_id,user_id,request_id,title,body)
      SELECT r.organization_id, gm.user_id, r.id,
        CASE WHEN NEW.action='reenviar' THEN 'Correção recebida — ' ELSE 'Nova solicitação aguardando — ' END||COALESCE(_svc,''),
        r.protocol||' · '||r.requester_name
      FROM sd_group_members gm WHERE gm.group_id=NEW.to_group_id AND gm.user_id <> r.requester_user_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sd_event_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sd_request_correction(uuid, text[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sd_resubmit_request(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sd_create_request(uuid, text, jsonb) FROM PUBLIC, anon;