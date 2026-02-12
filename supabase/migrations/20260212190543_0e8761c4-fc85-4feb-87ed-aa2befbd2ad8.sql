
-- Profile for alessandro (icca_admin)
INSERT INTO public.profiles (user_id, email, full_name)
VALUES ('8b50c558-dbe0-407b-a451-a6078783a24c', 'alessandro@icca.org.br', 'Alessandro');

-- Profile for administrativo (org_admin)
INSERT INTO public.profiles (user_id, email, full_name)
VALUES ('336b557c-1af5-4651-91ba-2b71e66486f4', 'administrativo@icca.org.br', 'Administrativo');

-- icca_admin global role for alessandro
INSERT INTO public.user_roles (user_id, role)
VALUES ('8b50c558-dbe0-407b-a451-a6078783a24c', 'icca_admin');

-- org_admin membership for administrativo
INSERT INTO public.organization_members (user_id, organization_id, role)
VALUES ('336b557c-1af5-4651-91ba-2b71e66486f4', '00000000-0000-0000-0000-000000000001', 'org_admin');

-- Default proponente membership for alessandro (needs org access too)
INSERT INTO public.organization_members (user_id, organization_id, role)
VALUES ('8b50c558-dbe0-407b-a451-a6078783a24c', '00000000-0000-0000-0000-000000000001', 'proponente');
