-- PROPOSTA URGENTE (não aplicada). Etapa 2 da auditoria de segurança.
--
-- Problema (crítico, confirmado no catálogo do banco, sem exploração):
--   * a política profiles_update_own deixa o usuário atualizar a própria linha de profiles;
--   * o papel authenticated tem UPDATE na coluna profiles.fomento_role;
--   * o trigger validate_fomento_role só valida os VALORES permitidos.
--   Resultado: qualquer usuário autenticado consegue executar
--     UPDATE profiles SET fomento_role = 'superadmin' WHERE user_id = auth.uid();
--   e obter acesso total ao módulo Fomento, sem passar por set_fomento_role.
--
-- Regra desejada pelo proprietário da plataforma:
--   * superadmin é o acesso total do criador; admins futuros NÃO podem nomear nem remover superadmin;
--   * só administradores do Fomento (superadmin ou admin) alteram papéis;
--   * não é permitido deixar o sistema sem nenhum superadmin.
--
-- Esta migration aplica a regra em QUALQUER caminho de escrita (cliente, RPC set_fomento_role),
-- porque fica no trigger de profiles. Execuções sem JWT (service_role, migrations, triggers de
-- cadastro) continuam liberadas: auth.uid() é nulo nesses contextos.
--
-- Verificação sugerida (ambiente de teste, nunca em produção):
--   1. Usuário comum: UPDATE profiles SET fomento_role='superadmin' na própria linha -> deve FALHAR.
--   2. Usuário comum: UPDATE ... fomento_role='gestor' na própria linha -> deve FALHAR.
--   3. admin: set_fomento_role(<outro>, 'gestor') -> deve funcionar.
--   4. admin: set_fomento_role(<outro>, 'superadmin') -> deve FALHAR.
--   5. admin: set_fomento_role(<superadmin>, 'gestor') -> deve FALHAR.
--   6. superadmin: set_fomento_role(<outro>, 'superadmin') -> deve funcionar.
--   7. superadmin: rebaixar o único superadmin -> deve FALHAR (último superadmin).
--   8. Cadastro de novo usuário (sem papel) continua funcionando.

CREATE OR REPLACE FUNCTION public.validate_fomento_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _old text;
  _caller_is_superadmin boolean;
BEGIN
  IF NEW.fomento_role IS NOT NULL
     AND NEW.fomento_role NOT IN ('superadmin', 'admin', 'gestor', 'auditor', 'coordenador') THEN
    RAISE EXCEPTION 'fomento_role must be superadmin, admin, gestor, auditor, coordenador, or NULL';
  END IF;

  -- service_role, migrations e triggers de cadastro não têm JWT.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _old := NULL;
  ELSE
    _old := OLD.fomento_role;
  END IF;

  IF NEW.fomento_role IS DISTINCT FROM _old THEN
    IF NOT public.has_fomento_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only fomento admins can change fomento roles';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND fomento_role = 'superadmin'
    ) INTO _caller_is_superadmin;

    IF (_old = 'superadmin' OR NEW.fomento_role = 'superadmin') AND NOT _caller_is_superadmin THEN
      RAISE EXCEPTION 'Only a superadmin can grant or revoke superadmin';
    END IF;

    IF _old = 'superadmin' AND NEW.fomento_role IS DISTINCT FROM 'superadmin' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.fomento_role = 'superadmin' AND p.user_id <> OLD.user_id
      ) THEN
        RAISE EXCEPTION 'Cannot remove the last superadmin';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
