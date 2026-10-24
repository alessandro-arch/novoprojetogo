# Conta administrativa projetogo-admin@innovago.app: etapa 1 (conta + MFA)

Escopo autorizado nesta etapa: criar a conta e configurar MFA. Nenhum perfil global é concedido aqui. A concessão de `icca_admin` e `superadmin` será um plano separado, com nova autorização.

## Fatos confirmados (leitura, sem alterações)
- A conta não existe em `auth.users` nem em `profiles`.
- Não há trigger em `auth.users`: a função `handle_new_user` existe, mas não está ligada. Criar o usuário NÃO cria a linha em `profiles` nem o vínculo em `organization_members`.
- `oe_curador.organization_id` aceita nulo, e `oe_is_curador()` já devolve verdadeiro para `icca_admin`. Logo, um registro em `oe_curador` é redundante: fica fora do plano.
- O app não tem tela de cadastro de MFA (nenhum uso de `supabase.auth.mfa`). Hoje o MFA só pode ser feito pelo painel do Supabase ou por uma tela nova.

## Ordem
1. Snapshot de leitura (antes): existência do usuário, perfil, `user_roles`, `organization_members`, `sd_members`, `oe_curador` e `audit_logs` ligados ao e-mail. Guardado como relatório no chat.
2. Você cria a conta no painel do Supabase (Authentication, Users, Add user), com e-mail confirmado e senha forte. Eu não crio por script.
3. Perfil: na sua autorização, eu crio a linha em `profiles` com `user_id`, `email` e `full_name = 'ProjetoGO Admin'`, `fomento_role` nulo. Sem vínculo em `organization_members` (evita virar proponente da organização padrão). Comando:
   ```sql
   INSERT INTO public.profiles (user_id, email, full_name)
   SELECT id, email, 'ProjetoGO Admin' FROM auth.users
   WHERE lower(email)='projetogo-admin@innovago.app'
   ON CONFLICT (user_id) DO NOTHING;
   ```
   Antes de rodar, confiro as políticas e triggers de `profiles` (o `validate_fomento_role` só age se o papel mudar).
4. MFA (TOTP). Duas opções para você decidir:
   - A) Tela "Segurança" em Meu perfil: cadastrar autenticador (QR code), verificar código, listar e remover fatores. Pequena mudança de código, sem banco.
   - B) Sem código: MFA configurado fora do app. Observação: o painel do Supabase não cadastra TOTP por usuário; sem a opção A não há como o titular cadastrar o fator.
   Recomendo A, testada no preview.
5. Validação: primeiro login, código TOTP exigido e aceito, sessão com nível `aal2`. Ainda sem privilégios.
6. Snapshot depois e relatório.

## Reversão
- Remover o fator MFA (pela tela ou painel).
- `DELETE FROM public.profiles WHERE user_id = '<ID>'` somente se nenhuma ação tiver sido registrada.
- Desativar (banir) o usuário no painel, nunca apagar, para preservar auditoria.

## Riscos
- Sem MFA obrigatório no login, a conta pode entrar com só a senha. A exigência de `aal2` nos painéis administrativos entra no plano da etapa 2, antes dos privilégios.
- A caixa de e-mail permite redefinir a senha: mantê-la com acesso restrito.

## Fora deste plano
- `icca_admin`, `fomento_role = 'superadmin'`, `oe_curador`, `sd_members`, migrations, deploy, publicação.
