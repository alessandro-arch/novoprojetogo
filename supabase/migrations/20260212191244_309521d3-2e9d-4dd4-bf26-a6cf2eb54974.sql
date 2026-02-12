
-- Profile for alessandro (new UUID)
INSERT INTO public.profiles (user_id, email, full_name)
VALUES ('138515d7-5e56-4932-93f8-bfde58e54462', 'alessandro@icca.org.br', 'Alessandro');

-- icca_admin global role
INSERT INTO public.user_roles (user_id, role)
VALUES ('138515d7-5e56-4932-93f8-bfde58e54462', 'icca_admin');

-- Default org membership
INSERT INTO public.organization_members (user_id, organization_id, role)
VALUES ('138515d7-5e56-4932-93f8-bfde58e54462', '00000000-0000-0000-0000-000000000001', 'proponente');
