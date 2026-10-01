ALTER TABLE public.sd_requests ADD COLUMN IF NOT EXISTS protocol text, ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.sd_request_events ADD COLUMN IF NOT EXISTS from_group_id uuid, ADD COLUMN IF NOT EXISTS to_group_id uuid;

CREATE OR REPLACE FUNCTION public.sd_set_protocol() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _sig text; _yr text; _n int;
BEGIN
  IF NEW.protocol IS NOT NULL THEN RETURN NEW; END IF;
  SELECT upper(COALESCE(NULLIF(sigla,''),'ORG')) INTO _sig FROM organizations WHERE id=NEW.organization_id;
  _yr := to_char(COALESCE(NEW.created_at, now()),'YYYY');
  PERFORM pg_advisory_xact_lock(hashtext(NEW.organization_id::text||_yr));
  SELECT COALESCE(max((regexp_match(protocol,'-(\d+)$'))[1]::int),0)+1 INTO _n FROM sd_requests
    WHERE organization_id=NEW.organization_id AND protocol LIKE 'SD-'||_sig||'-'||_yr||'-%';
  NEW.protocol := 'SD-'||_sig||'-'||_yr||'-'||lpad(_n::text,6,'0');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sd_requests_protocol ON public.sd_requests;
CREATE TRIGGER sd_requests_protocol BEFORE INSERT ON public.sd_requests FOR EACH ROW EXECUTE FUNCTION public.sd_set_protocol();

CREATE OR REPLACE FUNCTION public.sd_track_stage() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.current_group_id IS DISTINCT FROM OLD.current_group_id OR NEW.status IS DISTINCT FROM OLD.status THEN NEW.stage_entered_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sd_requests_stage ON public.sd_requests;
CREATE TRIGGER sd_requests_stage BEFORE UPDATE ON public.sd_requests FOR EACH ROW EXECUTE FUNCTION public.sd_track_stage();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM sd_requests WHERE protocol IS NULL ORDER BY created_at LOOP
    UPDATE sd_requests s SET protocol = x.p FROM (SELECT 'SD-'||upper(COALESCE(NULLIF(o.sigla,''),'ORG'))||'-'||to_char(q.created_at,'YYYY')||'-'||lpad((COALESCE((SELECT max((regexp_match(z.protocol,'-(\d+)$'))[1]::int) FROM sd_requests z WHERE z.organization_id=q.organization_id AND z.protocol LIKE 'SD-'||upper(COALESCE(NULLIF(o.sigla,''),'ORG'))||'-'||to_char(q.created_at,'YYYY')||'-%'),0)+1)::text,6,'0') p
      FROM sd_requests q JOIN organizations o ON o.id=q.organization_id WHERE q.id=r.id) x WHERE s.id=r.id;
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sd_requests_protocol_uniq ON public.sd_requests(organization_id, protocol);

CREATE TABLE public.sd_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  request_id uuid REFERENCES public.sd_requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.sd_notifications TO authenticated;
GRANT ALL ON public.sd_notifications TO service_role;
ALTER TABLE public.sd_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY sd_notif_select ON public.sd_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sd_notif_update ON public.sd_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX sd_notifications_user_idx ON public.sd_notifications(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sd_event_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; _svc text; _lbl text; _grp uuid;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=NEW.request_id;
  SELECT name INTO _svc FROM sd_services WHERE id=r.service_id;
  _lbl := CASE NEW.action WHEN 'criada' THEN 'Solicitação enviada' WHEN 'aprovar' THEN 'Solicitação autorizada'
    WHEN 'iniciar' THEN 'Execução iniciada' WHEN 'concluir' THEN 'Solicitação concluída' WHEN 'recusar' THEN 'Solicitação indeferida'
    WHEN 'corrigir' THEN 'Correção solicitada' ELSE NEW.action END;
  INSERT INTO sd_notifications(organization_id,user_id,request_id,title,body)
    VALUES (r.organization_id, r.requester_user_id, r.id, _lbl||' — '||COALESCE(_svc,''), r.protocol||COALESCE(' · '||NEW.note,''));
  _grp := r.current_group_id;
  IF _grp IS NOT NULL AND r.status NOT IN ('concluido','recusado','correcao') AND NEW.action IN ('criada','aprovar') THEN
    INSERT INTO sd_notifications(organization_id,user_id,request_id,title,body)
      SELECT r.organization_id, gm.user_id, r.id, 'Nova solicitação aguardando — '||COALESCE(_svc,''), r.protocol||' · '||r.requester_name
      FROM sd_group_members gm WHERE gm.group_id=_grp AND gm.user_id <> r.requester_user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sd_request_events_notify ON public.sd_request_events;
CREATE TRIGGER sd_request_events_notify AFTER INSERT ON public.sd_request_events FOR EACH ROW EXECUTE FUNCTION public.sd_event_notify();

CREATE OR REPLACE FUNCTION public.sd_advance_request(_id uuid, _action text, _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; sv record; _next uuid; _last boolean; _actor text; _to uuid;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'não encontrada'; END IF;
  IF r.status IN ('concluido','recusado') THEN RAISE EXCEPTION 'solicitação já encerrada'; END IF;
  IF NOT (sd_is_admin(auth.uid(), r.organization_id) OR (r.current_group_id IS NOT NULL AND sd_in_group(auth.uid(), r.current_group_id))) THEN
    RAISE EXCEPTION 'sem permissão nesta etapa'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=r.service_id;
  _last := r.step_index >= jsonb_array_length(sv.steps)-1;
  SELECT full_name INTO _actor FROM profiles WHERE user_id=auth.uid();
  _to := r.current_group_id;
  IF _action='recusar' THEN
    IF length(btrim(COALESCE(_note,'')))<3 THEN RAISE EXCEPTION 'informe o motivo'; END IF;
    UPDATE sd_requests SET status='recusado' WHERE id=_id; _to := NULL;
  ELSIF _action='corrigir' THEN
    IF length(btrim(COALESCE(_note,'')))<3 THEN RAISE EXCEPTION 'informe o que precisa ser corrigido'; END IF;
    UPDATE sd_requests SET status='correcao' WHERE id=_id;
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

CREATE OR REPLACE FUNCTION public.sd_create_request(_service_id uuid, _terms_hash text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me jsonb; sv record; _gid uuid; _id uuid;
BEGIN
  me := sd_me();
  IF me IS NULL THEN RAISE EXCEPTION 'Sem vínculo'; END IF;
  IF NOT (me->>'can_request')::boolean THEN RAISE EXCEPTION 'Seu acesso está suspenso'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=_service_id AND organization_id=(me->>'org')::uuid AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'serviço indisponível'; END IF;
  IF EXISTS (SELECT 1 FROM sd_requests WHERE requester_user_id=auth.uid() AND service_id=_service_id AND status IN ('em_analise','aprovado','em_andamento','correcao')) THEN
    RAISE EXCEPTION 'Você já tem uma solicitação em aberto para este serviço'; END IF;
  IF _terms_hash IS NULL OR _terms_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'termo não aceito'; END IF;
  SELECT id INTO _gid FROM sd_groups WHERE organization_id=sv.organization_id AND code=(sv.steps->>0);
  INSERT INTO sd_requests(organization_id,service_id,requester_user_id,requester_kind,requester_name,requester_enrollment,requester_email,requester_program,current_group_id,terms_hash,terms_accepted_at)
  VALUES (sv.organization_id,sv.id,auth.uid(),me->>'kind',me->>'name',me->>'enrollment',me->>'email',me->>'program',_gid,_terms_hash,now()) RETURNING id INTO _id;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,to_group_id) VALUES (_id,sv.organization_id,auth.uid(),me->>'name','criada',_gid);
  RETURN _id;
END $function$;