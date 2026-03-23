-- Assign fomento admin to alessandro@icca.org.br
UPDATE public.profiles SET fomento_role = 'admin' WHERE email = 'alessandro@icca.org.br';

-- Assign fomento viewer (gestor) to administrativo@icca.org.br
UPDATE public.profiles SET fomento_role = 'gestor' WHERE email = 'administrativo@icca.org.br';