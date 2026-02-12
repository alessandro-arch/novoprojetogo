
-- 1. Insert the default neutral organization (idempotent)
INSERT INTO public.organizations (id, name, slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Editais Abertos (Neutro)', 'editais-abertos', true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Update handle_new_user to also create membership in neutral org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Auto-link to neutral organization as proponente
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000001', 'proponente')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3. Create fallback RPC for legacy users without membership
CREATE OR REPLACE FUNCTION public.ensure_default_membership()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (auth.uid(), '00000000-0000-0000-0000-000000000001', 'proponente')
  ON CONFLICT DO NOTHING;
END;
$function$;
