
-- Add blind review configuration columns to editais
ALTER TABLE public.editais 
  ADD COLUMN IF NOT EXISTS blind_code_prefix text NULL,
  ADD COLUMN IF NOT EXISTS blind_code_strategy text NOT NULL DEFAULT 'sequential';

-- Add blind_code_generated_at to proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS blind_code_generated_at timestamptz NULL;

-- Update generate_blind_code trigger to use edital config
CREATE OR REPLACE FUNCTION public.generate_blind_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prefix text;
  _strategy text;
  _blind_enabled boolean;
  _seq int;
BEGIN
  -- Get edital config
  SELECT blind_review_enabled, blind_code_prefix, blind_code_strategy
  INTO _blind_enabled, _prefix, _strategy
  FROM editais WHERE id = NEW.edital_id;

  -- Only generate if blind review is enabled
  IF NOT COALESCE(_blind_enabled, true) THEN
    RETURN NEW;
  END IF;

  -- Default prefix
  IF _prefix IS NULL OR _prefix = '' THEN
    _prefix := 'ED' || extract(year from now())::text;
  END IF;

  IF COALESCE(_strategy, 'sequential') = 'uuid_short' THEN
    -- Generate short UUID-based code
    NEW.blind_code := _prefix || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  ELSE
    -- Sequential
    SELECT count(*) + 1 INTO _seq 
    FROM proposals 
    WHERE edital_id = NEW.edital_id AND blind_code IS NOT NULL;
    NEW.blind_code := _prefix || '-' || lpad(_seq::text, 3, '0');
  END IF;

  NEW.blind_code_generated_at := now();
  RETURN NEW;
END;
$function$;
