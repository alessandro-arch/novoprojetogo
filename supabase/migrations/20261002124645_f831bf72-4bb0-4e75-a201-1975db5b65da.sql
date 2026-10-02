ALTER TABLE public.sd_requests
  ADD COLUMN IF NOT EXISTS vpn_conf_path text,
  ADD COLUMN IF NOT EXISTS vpn_ip text,
  ADD COLUMN IF NOT EXISTS vpn_peer_key text,
  ADD COLUMN IF NOT EXISTS vpn_tech_note text,
  ADD COLUMN IF NOT EXISTS vpn_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS vpn_released_by text,
  ADD COLUMN IF NOT EXISTS vpn_valid_until date,
  ADD COLUMN IF NOT EXISTS vpn_status text,
  ADD COLUMN IF NOT EXISTS vpn_email_sent_at timestamptz;

INSERT INTO public.sd_settings(organization_id, key, value, description)
SELECT DISTINCT organization_id, 'vpn_instructions',
  to_jsonb('1. Instale o aplicativo WireGuard (wireguard.com/install).'||chr(10)||'2. Abra o WireGuard e importe o arquivo .conf anexado.'||chr(10)||'3. Ative o túnel e acesse o Portal de Periódicos CAPES.'||chr(10)||'O arquivo é pessoal e intransferível. Não compartilhe.'::text),
  'Instruções enviadas junto com o arquivo .conf da VPN'
FROM public.sd_services WHERE code='VPN_CAPES'
ON CONFLICT DO NOTHING;

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
    IF r.step_index > 0 THEN RAISE EXCEPTION 'indeferimento só é possível na etapa de análise; registre um impedimento técnico'; END IF;
    IF length(btrim(COALESCE(_note,'')))<3 THEN RAISE EXCEPTION 'informe o motivo'; END IF;
    UPDATE sd_requests SET status='recusado' WHERE id=_id; _to := NULL;
  ELSIF _action='aprovar' AND NOT _last THEN
    SELECT id INTO _next FROM sd_groups WHERE organization_id=r.organization_id AND code=(sv.steps->>(r.step_index+1));
    UPDATE sd_requests SET status='aprovado', step_index=step_index+1, current_group_id=_next WHERE id=_id; _to := _next;
  ELSIF _action='impedimento' AND r.step_index > 0 THEN
    IF length(btrim(COALESCE(_note,'')))<3 THEN RAISE EXCEPTION 'informe o motivo do impedimento'; END IF;
  ELSIF _action='iniciar' AND _last THEN
    UPDATE sd_requests SET status='em_andamento' WHERE id=_id;
  ELSIF _action='concluir' AND _last THEN
    UPDATE sd_requests SET status='concluido' WHERE id=_id; _to := NULL;
  ELSE RAISE EXCEPTION 'ação inválida nesta etapa'; END IF;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,note,from_group_id,to_group_id)
    VALUES (_id,r.organization_id,auth.uid(),_actor,_action,_note,r.current_group_id,_to);
END $function$;

CREATE OR REPLACE FUNCTION public.sd_release_vpn(_id uuid, _path text, _ip text, _peer_key text, _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; sv record; _actor text; _valid date;
BEGIN
  SELECT * INTO r FROM sd_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'não encontrada'; END IF;
  IF r.status NOT IN ('aprovado','em_andamento') THEN RAISE EXCEPTION 'solicitação não está aguardando configuração'; END IF;
  IF NOT (sd_is_admin(auth.uid(), r.organization_id) OR (r.current_group_id IS NOT NULL AND sd_in_group(auth.uid(), r.current_group_id))) THEN
    RAISE EXCEPTION 'sem permissão nesta etapa'; END IF;
  SELECT * INTO sv FROM sd_services WHERE id=r.service_id;
  IF r.step_index < jsonb_array_length(sv.steps)-1 THEN RAISE EXCEPTION 'a liberação ocorre apenas na etapa de execução'; END IF;
  IF _path IS NULL OR _path !~* ('^'||r.organization_id::text||'/vpn/'||r.id::text||'/[^/]+\.conf$') THEN RAISE EXCEPTION 'arquivo .conf inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='servicedesk' AND name=_path) THEN RAISE EXCEPTION 'arquivo .conf não encontrado'; END IF;
  IF length(COALESCE(_ip,''))>64 OR length(COALESCE(_peer_key,''))>200 OR length(COALESCE(_note,''))>2000 THEN RAISE EXCEPTION 'campo muito longo'; END IF;
  SELECT full_name INTO _actor FROM profiles WHERE user_id=auth.uid();
  SELECT current_deadline INTO _valid FROM sd_students WHERE organization_id=r.organization_id AND user_id=r.requester_user_id;
  IF _valid IS NULL THEN SELECT bond_deadline INTO _valid FROM sd_faculty WHERE organization_id=r.organization_id AND user_id=r.requester_user_id; END IF;
  UPDATE sd_requests SET status='concluido', vpn_conf_path=_path, vpn_ip=NULLIF(btrim(_ip),''), vpn_peer_key=NULLIF(btrim(_peer_key),''),
    vpn_tech_note=NULLIF(btrim(_note),''), vpn_released_at=now(), vpn_released_by=COALESCE(_actor,'Equipe técnica'),
    vpn_valid_until=_valid, vpn_status='ativo'
  WHERE id=_id;
  INSERT INTO sd_request_events(request_id,organization_id,actor_user_id,actor_name,action,note,from_group_id,to_group_id)
    VALUES (_id,r.organization_id,auth.uid(),_actor,'liberar_vpn',
      'Acesso VPN liberado'||CASE WHEN _valid IS NOT NULL THEN ' · válido até '||to_char(_valid,'DD/MM/YYYY') ELSE '' END,r.current_group_id,NULL);
END $function$;
REVOKE ALL ON FUNCTION public.sd_release_vpn(uuid,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sd_release_vpn(uuid,text,text,text,text) TO authenticated;

CREATE POLICY "sd vpn conf upload by stage group" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='servicedesk' AND (storage.foldername(name))[2]='vpn' AND EXISTS (
  SELECT 1 FROM public.sd_requests r WHERE r.id::text=(storage.foldername(name))[3] AND r.organization_id::text=(storage.foldername(name))[1]
  AND (public.sd_is_admin(auth.uid(), r.organization_id) OR (r.current_group_id IS NOT NULL AND public.sd_in_group(auth.uid(), r.current_group_id)))));

CREATE POLICY "sd vpn conf read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='servicedesk' AND (storage.foldername(name))[2]='vpn' AND EXISTS (
  SELECT 1 FROM public.sd_requests r WHERE r.id::text=(storage.foldername(name))[3] AND r.organization_id::text=(storage.foldername(name))[1]
  AND (r.requester_user_id=auth.uid() OR public.sd_is_admin(auth.uid(), r.organization_id)
       OR EXISTS (SELECT 1 FROM public.sd_group_members gm WHERE gm.user_id=auth.uid() AND gm.organization_id=r.organization_id))));