
-- Add 'user_role' column to audit_logs for storing the role at the time of the action
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_role text;

-- Make audit_logs truly immutable: revoke UPDATE and DELETE even for future policies
-- (Already no UPDATE/DELETE policies exist, but let's add an explicit deny trigger)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$function$;

CREATE TRIGGER prevent_audit_log_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_log_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _action text;
  _entity_id uuid;
  _org_id uuid;
  _user_id uuid;
  _user_role text;
  _metadata jsonb;
BEGIN
  -- Determine action
  _action := TG_ARGV[0] || '.' || lower(TG_OP);

  -- Get entity ID
  IF TG_OP = 'DELETE' THEN
    _entity_id := OLD.id;
  ELSE
    _entity_id := NEW.id;
  END IF;

  -- Get user from auth context (may be null for triggers)
  _user_id := auth.uid();

  -- Try to get organization_id from the row
  IF TG_OP = 'DELETE' THEN
    BEGIN _org_id := OLD.organization_id; EXCEPTION WHEN undefined_column THEN _org_id := NULL; END;
  ELSE
    BEGIN _org_id := NEW.organization_id; EXCEPTION WHEN undefined_column THEN _org_id := NULL; END;
  END IF;

  -- If no direct org_id, try via edital_id -> editais.organization_id
  IF _org_id IS NULL THEN
    BEGIN
      IF TG_OP = 'DELETE' THEN
        SELECT e.organization_id INTO _org_id FROM editais e WHERE e.id = OLD.edital_id;
      ELSE
        SELECT e.organization_id INTO _org_id FROM editais e WHERE e.id = NEW.edital_id;
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  -- If still no org_id, try via proposal_id -> proposals.organization_id
  IF _org_id IS NULL THEN
    BEGIN
      IF TG_OP = 'DELETE' THEN
        SELECT p.organization_id INTO _org_id FROM proposals p WHERE p.id = OLD.proposal_id;
      ELSE
        SELECT p.organization_id INTO _org_id FROM proposals p WHERE p.id = NEW.proposal_id;
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  -- Get user role
  IF _user_id IS NOT NULL THEN
    SELECT role::text INTO _user_role FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id LIMIT 1;
    IF _user_role IS NULL THEN
      SELECT role::text INTO _user_role FROM public.user_roles
      WHERE user_id = _user_id LIMIT 1;
    END IF;
  END IF;

  -- Build metadata with key changes
  _metadata := '{}'::jsonb;
  IF TG_OP = 'UPDATE' THEN
    -- Store changed columns for auditing
    _metadata := jsonb_build_object('operation', 'update');
  ELSIF TG_OP = 'INSERT' THEN
    _metadata := jsonb_build_object('operation', 'insert');
  ELSIF TG_OP = 'DELETE' THEN
    _metadata := jsonb_build_object('operation', 'delete');
  END IF;

  -- For status changes, capture old and new values
  IF TG_OP = 'UPDATE' THEN
    BEGIN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        _metadata := _metadata || jsonb_build_object('old_status', OLD.status::text, 'new_status', NEW.status::text);
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  INSERT INTO public.audit_logs (user_id, organization_id, entity, entity_id, action, metadata_json, user_role)
  VALUES (_user_id, _org_id, TG_ARGV[0], _entity_id, _action, _metadata, _user_role);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- Attach triggers to key tables
CREATE TRIGGER audit_editais
  AFTER INSERT OR UPDATE OR DELETE ON public.editais
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('edital');

CREATE TRIGGER audit_proposals
  AFTER INSERT OR UPDATE OR DELETE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('proposal');

CREATE TRIGGER audit_review_assignments
  AFTER INSERT OR UPDATE ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('review_assignment');

CREATE TRIGGER audit_reviews
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('review');

CREATE TRIGGER audit_proposal_decisions
  AFTER INSERT ON public.proposal_decisions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('proposal_decision');

CREATE TRIGGER audit_scoring_criteria
  AFTER INSERT OR UPDATE OR DELETE ON public.scoring_criteria
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('scoring_criteria');
