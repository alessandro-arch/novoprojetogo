DROP POLICY IF EXISTS oe_destinatario_proprio ON public.oe_destinatario;
CREATE POLICY oe_destinatario_leitura_propria ON public.oe_destinatario
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.oe_destinatario FROM authenticated, anon;
GRANT SELECT ON public.oe_destinatario TO authenticated;
GRANT ALL ON public.oe_destinatario TO service_role;

CREATE OR REPLACE FUNCTION public.oe_status_telegram()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'conectado', EXISTS (SELECT 1 FROM oe_destinatario WHERE user_id = auth.uid()
                  AND canal = 'telegram' AND ativo AND confirmado_em IS NOT NULL),
    'pendente_ate', (SELECT max(expira_em) FROM oe_vinculo_telegram WHERE user_id = auth.uid()
                  AND usado_em IS NULL AND expira_em > now()));
$$;

CREATE OR REPLACE FUNCTION public.oe_desconectar_telegram()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  UPDATE oe_seguidor_edital SET canal_telegram = false WHERE user_id = auth.uid() AND canal_telegram;
  UPDATE oe_destinatario SET ativo = false WHERE user_id = auth.uid() AND canal = 'telegram';
END $$;

CREATE OR REPLACE FUNCTION public.oe_gerar_vinculo_telegram()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  IF (SELECT count(*) FROM oe_vinculo_telegram WHERE user_id = auth.uid()
      AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'limite_codigos';
  END IF;
  UPDATE oe_vinculo_telegram SET expira_em = now()
   WHERE user_id = auth.uid() AND usado_em IS NULL AND expira_em > now();
  v_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO oe_vinculo_telegram (user_id, token_hash, expira_em)
  VALUES (auth.uid(), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now() + interval '15 minutes');
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.oe_validar_seguidor_telegram()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.canal_telegram AND NOT EXISTS (SELECT 1 FROM oe_destinatario WHERE user_id = NEW.user_id
     AND canal = 'telegram' AND ativo AND confirmado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'telegram_nao_conectado';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_oe_seguidor_telegram ON public.oe_seguidor_edital;
CREATE TRIGGER trg_oe_seguidor_telegram BEFORE INSERT OR UPDATE ON public.oe_seguidor_edital
  FOR EACH ROW EXECUTE FUNCTION public.oe_validar_seguidor_telegram();

REVOKE EXECUTE ON FUNCTION public.oe_confirmar_vinculo_telegram(text,text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.oe_confirmar_vinculo_telegram(text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.oe_gerar_vinculo_telegram(), public.oe_status_telegram(), public.oe_desconectar_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oe_gerar_vinculo_telegram(), public.oe_status_telegram(), public.oe_desconectar_telegram() TO authenticated;