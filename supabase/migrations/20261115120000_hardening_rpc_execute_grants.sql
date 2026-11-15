-- Endurecimento de RPCs SECURITY DEFINER expostas ao papel anon
-- Origem: auditoria de seguranca interna de 15/11/2026.
--
-- Contexto: a chave publica (anon) e publicada no bundle do frontend, por projeto.
-- Toda funcao SECURITY DEFINER executavel por anon ignora o RLS por construcao, entao
-- qualquer visitante nao autenticado pode chama-la pelo endpoint /rest/v1/rpc/<nome>.
-- Esta migration fecha o que NAO e usado antes do login.
--
-- ATENCAO ao editar este modulo: nao revogar EXECUTE de record_login_attempt nem de
-- check_login_lockout (projeto BolsaGo). Elas sao chamadas pelo fluxo de login, antes de
-- existir sessao, e a revogacao quebra o bloqueio por tentativas.

-- ---------------------------------------------------------------------------
-- 1) list_fomento_users(): devolvia user_id, email, full_name e fomento_role de
--    todos os usuarios do modulo Fomento para qualquer requisicao anonima.
--    Medido antes da correcao: HTTP 200 com 7 registros para uma chamada sem sessao.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.list_fomento_users() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_fomento_users() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_fomento_users()
 RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.email, p.full_name, p.fomento_role
  FROM public.profiles p
  WHERE p.fomento_role IS NOT NULL
    AND public.has_fomento_admin(auth.uid())
$function$;

-- ---------------------------------------------------------------------------
-- 2) has_fomento_access(): usada apenas em politicas de RLS declaradas
--    "TO authenticated" e nas Edge Functions. Nao e chamada antes do login.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.has_fomento_access(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_fomento_access(uuid) TO authenticated, service_role;
