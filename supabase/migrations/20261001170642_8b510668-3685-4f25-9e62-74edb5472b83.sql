CREATE TABLE public.sd_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, sigla text, status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE TABLE public.sd_faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment text NOT NULL, full_name text NOT NULL, contract_type text,
  bond_start date, bond_deadline date, can_advise boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ativo', absent_in_last_import boolean NOT NULL DEFAULT false,
  last_import_id uuid, user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, enrollment)
);
CREATE TABLE public.sd_faculty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES public.sd_faculty(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.sd_programs(id) ON DELETE CASCADE,
  UNIQUE (faculty_id, program_id)
);
CREATE TABLE public.sd_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment text NOT NULL, full_name text NOT NULL,
  program_id uuid REFERENCES public.sd_programs(id), level text NOT NULL,
  entry_date date, advisor_id uuid REFERENCES public.sd_faculty(id),
  status text NOT NULL DEFAULT 'ativo',
  regular_deadline date, current_deadline date,
  absent_in_last_import boolean NOT NULL DEFAULT false, last_import_id uuid, user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, enrollment)
);
CREATE TABLE public.sd_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_type text NOT NULL, program_id uuid REFERENCES public.sd_programs(id), period text,
  file_name text NOT NULL, storage_path text,
  total_count int NOT NULL DEFAULT 0, new_count int NOT NULL DEFAULT 0, changed_count int NOT NULL DEFAULT 0,
  unchanged_count int NOT NULL DEFAULT 0, absent_count int NOT NULL DEFAULT 0, error_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmada', summary jsonb,
  imported_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sd_import_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.sd_imports(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment text, outcome text NOT NULL, before_data jsonb, after_data jsonb, message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sd_programs, public.sd_faculty, public.sd_faculty_programs, public.sd_students TO authenticated;
GRANT SELECT, INSERT ON public.sd_imports, public.sd_import_records TO authenticated;
GRANT ALL ON public.sd_programs, public.sd_faculty, public.sd_faculty_programs, public.sd_students, public.sd_imports, public.sd_import_records TO service_role;

ALTER TABLE public.sd_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sd_faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sd_faculty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sd_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sd_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sd_import_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel ON public.sd_programs FOR SELECT TO authenticated USING (public.sd_is_member(auth.uid(), organization_id) OR public.sd_is_superadmin(auth.uid()));
CREATE POLICY adm ON public.sd_programs FOR ALL TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY sel ON public.sd_faculty FOR SELECT TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id) OR public.sd_has_role(auth.uid(), organization_id, 'operador') OR user_id = auth.uid());
CREATE POLICY adm ON public.sd_faculty FOR ALL TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY sel ON public.sd_faculty_programs FOR SELECT TO authenticated USING (public.sd_is_member(auth.uid(), organization_id) OR public.sd_is_superadmin(auth.uid()));
CREATE POLICY adm ON public.sd_faculty_programs FOR ALL TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY sel ON public.sd_students FOR SELECT TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id) OR public.sd_has_role(auth.uid(), organization_id, 'operador') OR user_id = auth.uid());
CREATE POLICY adm ON public.sd_students FOR ALL TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id)) WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY sel ON public.sd_imports FOR SELECT TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY ins ON public.sd_imports FOR INSERT TO authenticated WITH CHECK (public.sd_is_admin(auth.uid(), organization_id) AND imported_by = auth.uid());
CREATE POLICY sel ON public.sd_import_records FOR SELECT TO authenticated USING (public.sd_is_admin(auth.uid(), organization_id));
CREATE POLICY ins ON public.sd_import_records FOR INSERT TO authenticated WITH CHECK (public.sd_is_admin(auth.uid(), organization_id));

-- Deadline calculation from institution settings
CREATE OR REPLACE FUNCTION public.sd_calc_student_deadline() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _months int;
BEGIN
  IF NEW.level NOT IN ('mestrado','doutorado') THEN RAISE EXCEPTION 'nível deve ser mestrado ou doutorado'; END IF;
  IF NEW.status NOT IN ('ativo','inativo','trancado','concluido','desligado') THEN RAISE EXCEPTION 'status inválido'; END IF;
  IF NEW.entry_date IS NOT NULL AND (TG_OP='INSERT' OR NEW.entry_date IS DISTINCT FROM OLD.entry_date OR NEW.level IS DISTINCT FROM OLD.level) THEN
    SELECT (value->>NEW.level)::int INTO _months FROM sd_settings WHERE organization_id=NEW.organization_id AND key='academic_durations';
    IF _months IS NOT NULL THEN
      NEW.regular_deadline := (NEW.entry_date + make_interval(months => _months))::date;
      IF TG_OP='INSERT' OR OLD.current_deadline IS NULL OR OLD.current_deadline = OLD.regular_deadline THEN
        NEW.current_deadline := NEW.regular_deadline;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sd_students_deadline BEFORE INSERT OR UPDATE ON public.sd_students FOR EACH ROW EXECUTE FUNCTION public.sd_calc_student_deadline();

CREATE OR REPLACE FUNCTION public.sd_calc_faculty_deadline() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _cfg jsonb; _months int;
BEGIN
  IF NEW.status NOT IN ('ativo','inativo') THEN RAISE EXCEPTION 'status inválido'; END IF;
  SELECT value INTO _cfg FROM sd_settings WHERE organization_id=NEW.organization_id AND key='contract_types';
  IF NEW.contract_type IS NOT NULL AND _cfg IS NOT NULL AND NOT (_cfg ? NEW.contract_type) THEN
    RAISE EXCEPTION 'tipo de contrato não configurado: %', NEW.contract_type;
  END IF;
  _months := NULLIF(_cfg->>COALESCE(NEW.contract_type,''), '')::int;
  IF _months IS NOT NULL AND NEW.bond_start IS NOT NULL THEN
    NEW.bond_deadline := (NEW.bond_start + make_interval(months => _months))::date;
  ELSE NEW.bond_deadline := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sd_faculty_deadline BEFORE INSERT OR UPDATE ON public.sd_faculty FOR EACH ROW EXECUTE FUNCTION public.sd_calc_faculty_deadline();

CREATE TRIGGER upd BEFORE UPDATE ON public.sd_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd BEFORE UPDATE ON public.sd_faculty FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd BEFORE UPDATE ON public.sd_students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_sd_programs AFTER INSERT OR UPDATE OR DELETE ON public.sd_programs FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sd_programs');
CREATE TRIGGER audit_sd_faculty AFTER INSERT OR UPDATE OR DELETE ON public.sd_faculty FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sd_faculty');
CREATE TRIGGER audit_sd_students AFTER INSERT OR UPDATE OR DELETE ON public.sd_students FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sd_students');
CREATE TRIGGER audit_sd_imports AFTER INSERT ON public.sd_imports FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sd_imports');

-- Private storage for import files, segregated by organization folder
CREATE POLICY "sd files admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='servicedesk' AND public.sd_is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "sd files admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='servicedesk' AND public.sd_is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));