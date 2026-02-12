
-- ============================================================
-- FASE 1: Refatoração de arquitetura - eliminar duplicidade
-- ============================================================

-- 1. Adicionar status em organization_members
ALTER TABLE public.organization_members 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

-- 2. Criar tabela reviewer_profiles (dados específicos de avaliação)
CREATE TABLE public.reviewer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  areas jsonb NOT NULL DEFAULT '[]',
  keywords text[] DEFAULT '{}',
  orcid text,
  bio text,
  accepted_at timestamptz,
  first_terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

ALTER TABLE public.reviewer_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies para reviewer_profiles
CREATE POLICY "icca_admin full access reviewer_profiles"
  ON public.reviewer_profiles FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages reviewer_profiles"
  ON public.reviewer_profiles FOR ALL
  USING (
    has_org_role(auth.uid(), org_id, 'org_admin'::app_role) 
    OR has_org_role(auth.uid(), org_id, 'edital_manager'::app_role)
  );

CREATE POLICY "reviewer sees own reviewer_profile"
  ON public.reviewer_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "reviewer updates own reviewer_profile"
  ON public.reviewer_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER update_reviewer_profiles_updated_at
  BEFORE UPDATE ON public.reviewer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Adicionar campos de staging em reviewer_invites (pré-cadastro)
ALTER TABLE public.reviewer_invites 
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id),
  ADD COLUMN IF NOT EXISTS institution_custom_name text,
  ADD COLUMN IF NOT EXISTS institution_type text,
  ADD COLUMN IF NOT EXISTS areas jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lattes_url text,
  ADD COLUMN IF NOT EXISTS orcid text;

-- Tornar reviewer_id nullable (será depreciado)
ALTER TABLE public.reviewer_invites ALTER COLUMN reviewer_id DROP NOT NULL;

-- 4. Adicionar user_id em reviewer_conflicts (prepara depreciação de reviewer_id)
ALTER TABLE public.reviewer_conflicts 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- ============================================================
-- MIGRAÇÃO DE DADOS
-- ============================================================

-- 5. Migrar reviewers com user_id → reviewer_profiles
INSERT INTO public.reviewer_profiles (user_id, org_id, areas, keywords, orcid, bio, accepted_at, first_terms_accepted_at, terms_version)
SELECT r.user_id, r.org_id, r.areas, r.keywords, r.orcid, r.bio, r.accepted_at, r.first_terms_accepted_at, r.terms_version
FROM public.reviewers r
WHERE r.user_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 6. Atualizar profiles com dados pessoais dos reviewers
UPDATE public.profiles p
SET 
  full_name = COALESCE(NULLIF(p.full_name, ''), r.full_name),
  institution_id = COALESCE(p.institution_id, r.institution_id),
  institution_custom_name = COALESCE(p.institution_custom_name, r.institution_custom_name),
  institution_type = COALESCE(p.institution_type, r.institution_type),
  lattes_url = COALESCE(p.lattes_url, r.lattes_url),
  cpf = COALESCE(p.cpf, r.cpf_last4)
FROM public.reviewers r
WHERE r.user_id = p.user_id AND r.user_id IS NOT NULL;

-- 7. Copiar dados de staging para reviewer_invites
UPDATE public.reviewer_invites ri
SET 
  full_name = COALESCE(ri.full_name, r.full_name),
  institution = COALESCE(ri.institution, r.institution),
  institution_id = COALESCE(ri.institution_id, r.institution_id),
  institution_custom_name = COALESCE(ri.institution_custom_name, r.institution_custom_name),
  institution_type = COALESCE(ri.institution_type, r.institution_type),
  areas = COALESCE(ri.areas, r.areas),
  keywords = COALESCE(ri.keywords, r.keywords),
  lattes_url = COALESCE(ri.lattes_url, r.lattes_url),
  orcid = COALESCE(ri.orcid, r.orcid)
FROM public.reviewers r
WHERE r.id = ri.reviewer_id;

-- 8. Atualizar status em organization_members baseado em reviewers
UPDATE public.organization_members om
SET status = CASE 
  WHEN r.status = 'ACTIVE' THEN 'ativo'
  WHEN r.status = 'INVITED' THEN 'convidado'
  WHEN r.status = 'SUSPENDED' THEN 'suspenso'
  ELSE 'ativo'
END
FROM public.reviewers r
WHERE r.user_id = om.user_id AND om.role = 'reviewer'::app_role;

-- 9. Migrar reviewer_conflicts.user_id
UPDATE public.reviewer_conflicts rc
SET user_id = r.user_id
FROM public.reviewers r
WHERE r.id = rc.reviewer_id AND r.user_id IS NOT NULL;

-- 10. Garantir unicidade de CPF e email em profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique 
  ON public.profiles (cpf) WHERE cpf IS NOT NULL AND cpf != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
  ON public.profiles (email) WHERE email IS NOT NULL AND email != '';
