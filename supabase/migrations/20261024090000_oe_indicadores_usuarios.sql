-- PROPOSTA (nao aplicada). Indicadores agregados de usuarios do Operon para o painel da Curadoria.
--
-- Devolve SOMENTE numeros e os 5 editais mais seguidos. Nao devolve nenhum dado pessoal
-- (sem nomes, e-mails, ids de usuario ou chats). Responde apenas para icca_admin.
-- Nao altera tabelas nem policies; so cria uma funcao somente de leitura.
--
-- Definicoes:
--   usuarios_com_acesso : usuarios distintos em organization_members de organizacoes com oe_org_config.ativa
--   com_telegram        : usuarios com destinatario canal 'telegram' ativo (vinculo concluido pelo Hermes)
--   com_email_ativo     : usuarios com destinatario canal 'email' ativo
--   seguindo_algum      : usuarios com ao menos um registro em oe_seguidor_edital
--   mais_seguidos       : os 5 editais com mais seguidores (id, numero, ano, titulo, seguidores)
--
-- Verificacao sugerida:
--   1. icca_admin: select public.oe_indicadores_usuarios();  -> devolve o JSON com os totais.
--   2. usuario comum autenticado: mesma chamada -> deve FALHAR com "Acesso restrito".
--   3. anon: sem permissao de execucao.

CREATE OR REPLACE FUNCTION public.oe_indicadores_usuarios()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'icca_admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'usuarios_com_acesso', (
      SELECT count(DISTINCT m.user_id)
      FROM public.organization_members m
      JOIN public.oe_org_config c ON c.organization_id = m.organization_id AND c.ativa
    ),
    'com_telegram', (
      SELECT count(DISTINCT user_id) FROM public.oe_destinatario WHERE canal = 'telegram' AND ativo
    ),
    'com_email_ativo', (
      SELECT count(DISTINCT user_id) FROM public.oe_destinatario WHERE canal = 'email' AND ativo
    ),
    'seguindo_algum', (
      SELECT count(DISTINCT user_id) FROM public.oe_seguidor_edital
    ),
    'mais_seguidos', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT e.id, e.numero, e.ano, e.titulo, count(*) AS seguidores
        FROM public.oe_seguidor_edital s
        JOIN public.oe_edital e ON e.id = s.edital_id
        GROUP BY e.id, e.numero, e.ano, e.titulo
        ORDER BY count(*) DESC, e.titulo
        LIMIT 5
      ) x
    )
  ) INTO r;

  RETURN r;
END;
$function$;

REVOKE ALL ON FUNCTION public.oe_indicadores_usuarios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oe_indicadores_usuarios() TO authenticated;
