
-- Table: reviewers (banco de avaliadores por organização)
CREATE TABLE public.reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  institution text NOT NULL,
  areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords text[] DEFAULT NULL,
  lattes_url text,
  orcid text,
  bio text,
  status text NOT NULL DEFAULT 'INVITED',
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviewers_org_email_unique UNIQUE(org_id, email)
);

CREATE INDEX idx_reviewers_org_status ON public.reviewers(org_id, status);
CREATE INDEX idx_reviewers_user_id ON public.reviewers(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_reviewers_updated_at
  BEFORE UPDATE ON public.reviewers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.reviewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icca_admin full access reviewers"
  ON public.reviewers FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages reviewers"
  ON public.reviewers FOR ALL
  USING (
    has_org_role(auth.uid(), org_id, 'org_admin'::app_role)
    OR has_org_role(auth.uid(), org_id, 'edital_manager'::app_role)
  );

CREATE POLICY "reviewer sees own record"
  ON public.reviewers FOR SELECT
  USING (user_id = auth.uid());

-- Table: reviewer_invites
CREATE TABLE public.reviewer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.reviewers(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviewer_invites_token ON public.reviewer_invites(token_hash);
CREATE INDEX idx_reviewer_invites_reviewer ON public.reviewer_invites(reviewer_id);

ALTER TABLE public.reviewer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icca_admin full access invites"
  ON public.reviewer_invites FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages invites"
  ON public.reviewer_invites FOR ALL
  USING (
    has_org_role(auth.uid(), org_id, 'org_admin'::app_role)
    OR has_org_role(auth.uid(), org_id, 'edital_manager'::app_role)
  );

-- Table: reviewer_conflicts (placeholder for future)
CREATE TABLE public.reviewer_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES public.reviewers(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conflict_type text NOT NULL DEFAULT 'general',
  description text,
  declared_at timestamptz NOT NULL DEFAULT now(),
  declared_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.reviewer_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icca_admin full access conflicts"
  ON public.reviewer_conflicts FOR ALL
  USING (has_role(auth.uid(), 'icca_admin'::app_role));

CREATE POLICY "org staff manages conflicts"
  ON public.reviewer_conflicts FOR ALL
  USING (
    has_org_role(auth.uid(), org_id, 'org_admin'::app_role)
    OR has_org_role(auth.uid(), org_id, 'edital_manager'::app_role)
  );
