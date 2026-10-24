-- PROPOSTA (nao aplicada). Regra de dominio de e-mail para equipe e docentes por organizacao.
--
-- Decisao do produto (Alessandro, 23/10/2026):
--   * Docentes e equipe da UVV (Operon Fomento e Service Desk): e-mail @uvv.br.
--   * Alunos: sem restricao de dominio (entram com a matricula e podem usar e-mail alternativo).
--   * Proponentes: qualquer e-mail (editais publicos).
--   * Cada organizacao tem a propria lista; a UVV nao e herdada por outras.
--   * Excecoes explicitas: icca_admin e superadmin (atravessam organizacoes).
--
-- Escopo: so valida NOVAS atribuicoes (INSERT, ou UPDATE de user_id/role). Nao altera nem remove
-- vinculos existentes. Para listar quem ja esta fora da regra, rode a consulta de relatorio no
-- final deste arquivo (somente leitura).
--
-- Tabelas cobertas:
--   organization_members : somente role in ('org_admin', 'edital_manager')   (proponente/reviewer livres)
--   sd_members           : todos os papeis (equipe do Service Desk)
--   sd_faculty           : quando user_id e preenchido (docente com acesso)
--   sd_students          : NAO coberta (aluno livre)
-- Nao coberta nesta proposta: profiles.fomento_role (nao ha vinculo organizacao x perfil no modelo
-- atual; decidir antes se admin/coordenador do Fomento herdam o dominio da UVV).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS staff_email_domains text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.organizations.staff_email_domains IS
  'Dominios de e-mail permitidos para equipe e docentes da organizacao (ex.: {uvv.br}). Vazio = sem restricao.';

-- Valor inicial: usa o dominio ja cadastrado na organizacao (UVV: uvv.br).
UPDATE public.organizations
   SET staff_email_domains = ARRAY[lower(domain)]
 WHERE domain IS NOT NULL AND staff_email_domains = '{}';

CREATE OR REPLACE FUNCTION public.staff_email_domain_ok(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_domains text[];
  v_email text;
BEGIN
  SELECT staff_email_domains INTO v_domains FROM public.organizations WHERE id = _org_id;
  IF v_domains IS NULL OR cardinality(v_domains) = 0 THEN
    RETURN true;  -- organizacao sem restricao configurada
  END IF;

  IF public.has_role(_user_id, 'icca_admin') THEN
    RETURN true;  -- excecao explicita: admin ICCA
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.fomento_role = 'superadmin') THEN
    RETURN true;  -- excecao explicita: superadmin
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = _user_id;
  IF v_email IS NULL THEN
    RETURN false;
  END IF;
  RETURN lower(split_part(v_email, '@', 2)) = ANY (SELECT lower(d) FROM unnest(v_domains) AS d);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_email_domain_ok(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_staff_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'organization_members' THEN
    IF NEW.role::text NOT IN ('org_admin', 'edital_manager') THEN
      RETURN NEW;  -- proponente e reviewer: qualquer e-mail
    END IF;
    v_org := NEW.organization_id;
  ELSE
    v_org := NEW.organization_id;  -- sd_members e sd_faculty
  END IF;

  IF NOT public.staff_email_domain_ok(NEW.user_id, v_org) THEN
    RAISE EXCEPTION 'E-mail fora do dominio permitido para a equipe desta organizacao'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_staff_email_domain() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_staff_email_domain ON public.organization_members;
CREATE TRIGGER trg_staff_email_domain
  BEFORE INSERT OR UPDATE OF user_id, role, organization_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_staff_email_domain();

DROP TRIGGER IF EXISTS trg_staff_email_domain ON public.sd_members;
CREATE TRIGGER trg_staff_email_domain
  BEFORE INSERT OR UPDATE OF user_id, role, organization_id ON public.sd_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_staff_email_domain();

DROP TRIGGER IF EXISTS trg_staff_email_domain ON public.sd_faculty;
CREATE TRIGGER trg_staff_email_domain
  BEFORE INSERT OR UPDATE OF user_id, organization_id ON public.sd_faculty
  FOR EACH ROW EXECUTE FUNCTION public.tg_staff_email_domain();

-- Relatorio de vinculos existentes fora da regra (somente leitura; nao remove nada):
--   select 'organization_members' as tabela, m.user_id, m.role::text as papel, split_part(u.email,'@',2) as dominio
--     from public.organization_members m join auth.users u on u.id = m.user_id
--     join public.organizations o on o.id = m.organization_id
--    where m.role::text in ('org_admin','edital_manager') and cardinality(o.staff_email_domains) > 0
--      and not public.staff_email_domain_ok(m.user_id, m.organization_id)
--   union all
--   select 'sd_members', m.user_id, m.role, split_part(u.email,'@',2) from public.sd_members m
--     join auth.users u on u.id = m.user_id where not public.staff_email_domain_ok(m.user_id, m.organization_id)
--   union all
--   select 'sd_faculty', f.user_id, 'docente', split_part(u.email,'@',2) from public.sd_faculty f
--     join auth.users u on u.id = f.user_id where not public.staff_email_domain_ok(f.user_id, f.organization_id);
