-- PROPOSTA (não aplicada). Etapa 1 da auditoria de segurança.
--
-- Problema: a política vigente de INSERT em audit_logs é
--   WITH CHECK (auth.uid() = user_id)
-- e permite que qualquer usuário autenticado grave registros em QUALQUER organização
-- (organization_id arbitrário), poluindo a trilha de auditoria de terceiros.
--
-- Esta migration mantém o comportamento atual dos fluxos legítimos e fecha o gap entre organizações:
--   * o registro continua precisando pertencer ao próprio usuário (user_id = auth.uid());
--   * organization_id deve ser nulo (fluxos de avaliador, que não informam organização),
--     ou uma organização da qual o usuário é membro, ou o usuário deve ser icca_admin.
-- Os triggers de auditoria (fn_audit_trigger) são SECURITY DEFINER e não são afetados.
--
-- LIMITAÇÃO CONHECIDA: um usuário ainda pode gravar eventos falsos na PRÓPRIA organização ou sem
-- organização. O fechamento completo exige mover as ~19 gravações do front-end (ReviewManagement,
-- ProposalDistribution, EditalDetail, etc.) para uma RPC SECURITY DEFINER que defina user_id, papel
-- e organização no servidor e valide uma lista de ações. Fica para a Etapa 1b, com aprovação.
--
-- Verificação sugerida (em ambiente de teste, nunca em produção):
--   1. Como usuário da organização A: INSERT em audit_logs com organization_id da organização B
--      deve falhar com "new row violates row-level security policy".
--   2. Como usuário da organização A: INSERT com organization_id = A, ou NULL, deve funcionar.
--   3. Como icca_admin: INSERT com qualquer organization_id deve funcionar.
--   4. Alterações em editais/propostas continuam gerando registros pelos triggers.

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      organization_id IS NULL
      OR public.is_org_member(auth.uid(), organization_id)
      OR public.has_role(auth.uid(), 'icca_admin')
    )
  );
