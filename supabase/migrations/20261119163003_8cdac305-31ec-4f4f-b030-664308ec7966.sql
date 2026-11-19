CREATE OR REPLACE FUNCTION public.sd_calc_student_deadline()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE _months int;
BEGIN
  IF NEW.level NOT IN ('graduacao','mestrado','doutorado') THEN RAISE EXCEPTION 'nível deve ser graduação, mestrado ou doutorado'; END IF;
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
END $function$;