
-- =============================================
-- SisConnecta Pro - Phase 1 Database Schema
-- =============================================

-- Role enum
CREATE TYPE public.app_role AS ENUM ('icca_admin', 'org_admin', 'edital_manager', 'proponente');

-- Edital status enum
CREATE TYPE public.edital_status AS ENUM ('draft', 'published', 'closed');

-- Proposal status enum
CREATE TYPE public.proposal_status AS ENUM ('draft', 'submitted', 'under_review', 'accepted', 'rejected');

-- =============================================
-- TABLES
-- =============================================

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organization members (links users to orgs with roles)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'proponente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- User roles (global roles like icca_admin)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Editais
CREATE TABLE public.editais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.edital_status NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Knowledge areas
CREATE TABLE public.knowledge_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.knowledge_areas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Edital <-> knowledge area mapping
CREATE TABLE public.edital_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  knowledge_area_id UUID NOT NULL REFERENCES public.knowledge_areas(id) ON DELETE CASCADE,
  UNIQUE(edital_id, knowledge_area_id)
);

-- Edital form schemas
CREATE TABLE public.edital_form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  schema_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proposals
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  proponente_user_id UUID NOT NULL REFERENCES auth.users(id),
  knowledge_area_id UUID REFERENCES public.knowledge_areas(id),
  status public.proposal_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

-- Proposal answers
CREATE TABLE public.proposal_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL UNIQUE REFERENCES public.proposals(id) ON DELETE CASCADE,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proposal files
CREATE TABLE public.proposal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_editais_org ON public.editais(organization_id);
CREATE INDEX idx_editais_status ON public.editais(status);
CREATE INDEX idx_proposals_edital ON public.proposals(edital_id);
CREATE INDEX idx_proposals_user ON public.proposals(proponente_user_id);
CREATE INDEX idx_proposals_org ON public.proposals(organization_id);
CREATE INDEX idx_knowledge_areas_org ON public.knowledge_areas(organization_id);
CREATE INDEX idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity, entity_id);

-- =============================================
-- HELPER FUNCTIONS (security definer)
-- =============================================

-- Check if user has a global role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is member of org with specific role
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  )
$$;

-- Check if user belongs to org (any role)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- Get user's organization id
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id LIMIT 1
$$;

-- Get user's org role
CREATE OR REPLACE FUNCTION public.get_user_org_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = _user_id LIMIT 1
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_editais_updated_at BEFORE UPDATE ON public.editais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proposal_answers_updated_at BEFORE UPDATE ON public.proposal_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_form_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- ORGANIZATIONS
CREATE POLICY "icca_admin full access" ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org members can view their org" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "anyone can view active orgs for registration" ON public.organizations FOR SELECT TO authenticated
  USING (is_active = true);

-- ORGANIZATION_MEMBERS
CREATE POLICY "icca_admin full access members" ON public.organization_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org_admin manages members" ON public.organization_members FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'org_admin'));

CREATE POLICY "members see own org members" ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- USER_ROLES
CREATE POLICY "icca_admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- PROFILES
CREATE POLICY "users see own profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "icca_admin sees all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org admins see org member profiles" ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = profiles.user_id
      AND (
        public.has_org_role(auth.uid(), om.organization_id, 'org_admin')
        OR public.has_org_role(auth.uid(), om.organization_id, 'edital_manager')
      )
    )
  );

-- EDITAIS
CREATE POLICY "icca_admin full access editais" ON public.editais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff manages editais" ON public.editais FOR ALL TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'org_admin')
    OR public.has_org_role(auth.uid(), organization_id, 'edital_manager')
  );

CREATE POLICY "proponentes see published editais of their org" ON public.editais FOR SELECT TO authenticated
  USING (
    status = 'published' AND public.is_org_member(auth.uid(), organization_id)
  );

-- KNOWLEDGE_AREAS
CREATE POLICY "icca_admin full access areas" ON public.knowledge_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff manages areas" ON public.knowledge_areas FOR ALL TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'org_admin')
    OR public.has_org_role(auth.uid(), organization_id, 'edital_manager')
  );

CREATE POLICY "org members see areas" ON public.knowledge_areas FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- EDITAL_AREAS
CREATE POLICY "icca_admin full access edital_areas" ON public.edital_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff manages edital_areas" ON public.edital_areas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.editais e
      WHERE e.id = edital_areas.edital_id
      AND (
        public.has_org_role(auth.uid(), e.organization_id, 'org_admin')
        OR public.has_org_role(auth.uid(), e.organization_id, 'edital_manager')
      )
    )
  );

CREATE POLICY "org members see edital_areas" ON public.edital_areas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.editais e
      WHERE e.id = edital_areas.edital_id
      AND public.is_org_member(auth.uid(), e.organization_id)
    )
  );

-- EDITAL_FORM_SCHEMAS
CREATE POLICY "icca_admin full access schemas" ON public.edital_form_schemas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff manages schemas" ON public.edital_form_schemas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.editais e
      WHERE e.id = edital_form_schemas.edital_id
      AND (
        public.has_org_role(auth.uid(), e.organization_id, 'org_admin')
        OR public.has_org_role(auth.uid(), e.organization_id, 'edital_manager')
      )
    )
  );

CREATE POLICY "org members see active schemas" ON public.edital_form_schemas FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.editais e
      WHERE e.id = edital_form_schemas.edital_id
      AND public.is_org_member(auth.uid(), e.organization_id)
    )
  );

-- PROPOSALS
CREATE POLICY "icca_admin full access proposals" ON public.proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff sees org proposals" ON public.proposals FOR SELECT TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'org_admin')
    OR public.has_org_role(auth.uid(), organization_id, 'edital_manager')
  );

CREATE POLICY "proponente manages own proposals" ON public.proposals FOR ALL TO authenticated
  USING (proponente_user_id = auth.uid())
  WITH CHECK (proponente_user_id = auth.uid());

-- PROPOSAL_ANSWERS
CREATE POLICY "icca_admin full access answers" ON public.proposal_answers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff sees org answers" ON public.proposal_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_answers.proposal_id
      AND (
        public.has_org_role(auth.uid(), p.organization_id, 'org_admin')
        OR public.has_org_role(auth.uid(), p.organization_id, 'edital_manager')
      )
    )
  );

CREATE POLICY "proponente manages own answers" ON public.proposal_answers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_answers.proposal_id
      AND p.proponente_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_answers.proposal_id
      AND p.proponente_user_id = auth.uid()
    )
  );

-- PROPOSAL_FILES
CREATE POLICY "icca_admin full access files" ON public.proposal_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff sees org files" ON public.proposal_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_files.proposal_id
      AND (
        public.has_org_role(auth.uid(), p.organization_id, 'org_admin')
        OR public.has_org_role(auth.uid(), p.organization_id, 'edital_manager')
      )
    )
  );

CREATE POLICY "proponente manages own files" ON public.proposal_files FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_files.proposal_id
      AND p.proponente_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_files.proposal_id
      AND p.proponente_user_id = auth.uid()
    )
  );

-- AUDIT_LOGS
CREATE POLICY "icca_admin sees all logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'icca_admin'));

CREATE POLICY "org staff sees org logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL AND (
      public.has_org_role(auth.uid(), organization_id, 'org_admin')
      OR public.has_org_role(auth.uid(), organization_id, 'edital_manager')
    )
  );

CREATE POLICY "authenticated users can insert logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- STORAGE
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-files', 'proposal-files', false);

CREATE POLICY "proponente uploads own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proposal-files'
    AND (storage.foldername(name))[1] IS NOT NULL
  );

CREATE POLICY "proponente reads own files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proposal-files'
    AND (
      public.has_role(auth.uid(), 'icca_admin')
      OR EXISTS (
        SELECT 1 FROM public.proposals p
        JOIN public.proposal_files pf ON pf.proposal_id = p.id
        WHERE pf.file_path = name
        AND (
          p.proponente_user_id = auth.uid()
          OR public.has_org_role(auth.uid(), p.organization_id, 'org_admin')
          OR public.has_org_role(auth.uid(), p.organization_id, 'edital_manager')
        )
      )
    )
  );

CREATE POLICY "proponente deletes own files" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'proposal-files'
    AND EXISTS (
      SELECT 1 FROM public.proposals p
      JOIN public.proposal_files pf ON pf.proposal_id = p.id
      WHERE pf.file_path = name
      AND p.proponente_user_id = auth.uid()
      AND p.status = 'draft'
    )
  );
