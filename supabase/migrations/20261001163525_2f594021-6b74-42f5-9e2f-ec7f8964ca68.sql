ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS sigla text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE TABLE public.sd_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'solicitante',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sd_members TO authenticated;
GRANT ALL ON public.sd_members TO service_role;
ALTER TABLE public.sd_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sd_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sd_groups TO authenticated;
GRANT ALL ON public.sd_groups TO service_role;
ALTER TABLE public.sd_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sd_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.sd_groups(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sd_group_members TO authenticated;
GRANT ALL ON public.sd_group_members TO service_role;
ALTER TABLE public.sd_group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sd_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sd_settings TO authenticated;
GRANT ALL ON public.sd_settings TO service_role;
ALTER TABLE public.sd_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sd_is_superadmin(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'icca_admin')
$$;
CREATE OR REPLACE FUNCTION public.sd_is_member(_user_id uuid, _org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sd_members WHERE user_id=_user_id AND organization_id=_org_id AND status='ativo')
$$;
CREATE OR REPLACE FUNCTION public.sd_has_role(_user_id uuid, _org_id uuid, _role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sd_members WHERE user_id=_user_id AND organization_id=_org_id AND role=_role AND status='ativo')
$$;
CREATE OR REPLACE FUNCTION public.sd_is_admin(_user_id uuid, _org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.sd_is_superadmin(_user_id) OR public.sd_has_role(_user_id, _org_id, 'admin')
$$;
CREATE OR REPLACE FUNCTION public.sd_in_group(_user_id uuid, _group_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sd_group_members WHERE user_id=_user_id AND group_id=_group_id)
$$;

CREATE OR REPLACE FUNCTION public.validate_sd_member() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role NOT IN ('admin','operador','solicitante_aluno','solicitante_professor','solicitante') THEN
    RAISE EXCEPTION 'role inválido';
  END IF;
  IF NEW.status NOT IN ('ativo','inativo') THEN RAISE EXCEPTION 'status inválido'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_sd_member BEFORE INSERT OR UPDATE ON public.sd_members FOR EACH ROW EXECUTE FUNCTION public.validate_sd_member();

CREATE TRIGGER trg_sd_members_upd BEFORE UPDATE ON public.sd_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sd_groups_upd BEFORE UPDATE ON public.sd_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sd_settings_upd BEFORE UPDATE ON public.sd_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_sd_members AFTER INSERT OR UPDATE OR DELETE ON public.sd_members FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sd_members');
CREATE TRIGGER audit_sd_groups AFTER INSERT OR UPDATE OR DELETE ON public.sd_groups FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sd_groups');
CREATE TRIGGER audit_sd_settings AFTER INSERT OR UPDATE OR DELETE ON public.sd_settings FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sd_settings');

-- Policies
CREATE POLICY sd_members_select ON public.sd_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY sd_members_admin_write ON public.sd_members FOR ALL TO authenticated
  USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));

CREATE POLICY sd_groups_select ON public.sd_groups FOR SELECT TO authenticated
  USING (public.sd_is_member(auth.uid(), organization_id) OR public.sd_is_superadmin(auth.uid()));
CREATE POLICY sd_groups_admin_write ON public.sd_groups FOR ALL TO authenticated
  USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));

CREATE POLICY sd_group_members_select ON public.sd_group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY sd_group_members_admin_write ON public.sd_group_members FOR ALL TO authenticated
  USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));

CREATE POLICY sd_settings_select ON public.sd_settings FOR SELECT TO authenticated
  USING (public.sd_is_member(auth.uid(), organization_id) OR public.sd_is_superadmin(auth.uid()));
CREATE POLICY sd_settings_admin_write ON public.sd_settings FOR ALL TO authenticated
  USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));

CREATE POLICY orgs_superadmin_write ON public.organizations FOR ALL TO authenticated
  USING (public.sd_is_superadmin(auth.uid())) WITH CHECK (public.sd_is_superadmin(auth.uid()));
CREATE POLICY orgs_sd_admin_update ON public.organizations FOR UPDATE TO authenticated
  USING (public.sd_has_role(auth.uid(), id, 'admin')) WITH CHECK (public.sd_has_role(auth.uid(), id, 'admin'));