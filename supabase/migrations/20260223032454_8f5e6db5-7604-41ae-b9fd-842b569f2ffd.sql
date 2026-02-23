
-- Fix 1: Restrict project_bank_accounts SELECT to org_admin/edital_manager only
DROP POLICY IF EXISTS "project_bank_accounts_select" ON public.project_bank_accounts;
CREATE POLICY "project_bank_accounts_select" ON public.project_bank_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_executions pe
      WHERE pe.id = project_bank_accounts.project_execution_id
      AND (
        has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
      )
    )
  );

-- Fix 2: Also restrict other financial tables SELECT to org_admin/edital_manager
DROP POLICY IF EXISTS "bank_statements_select" ON public.bank_statements;
CREATE POLICY "bank_statements_select" ON public.bank_statements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_executions pe
      WHERE pe.id = bank_statements.project_execution_id
      AND (
        has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
      )
    )
  );

DROP POLICY IF EXISTS "bank_transactions_select" ON public.bank_transactions;
CREATE POLICY "bank_transactions_select" ON public.bank_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bank_statements bs
      JOIN project_executions pe ON pe.id = bs.project_execution_id
      WHERE bs.id = bank_transactions.bank_statement_id
      AND (
        has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
      )
    )
  );

DROP POLICY IF EXISTS "expense_payments_select" ON public.expense_payments;
CREATE POLICY "expense_payments_select" ON public.expense_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_expenses ex
      JOIN project_executions pe ON pe.id = ex.project_execution_id
      WHERE ex.id = expense_payments.expense_id
      AND (
        has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
      )
    )
  );

DROP POLICY IF EXISTS "project_expenses_select" ON public.project_expenses;
CREATE POLICY "project_expenses_select" ON public.project_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_executions pe
      WHERE pe.id = project_expenses.project_execution_id
      AND (
        has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
      )
    )
  );

DROP POLICY IF EXISTS "project_refunds_select" ON public.project_refunds;
CREATE POLICY "project_refunds_select" ON public.project_refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_executions pe
      WHERE pe.id = project_refunds.project_execution_id
      AND (
        has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
      )
    )
  );

DROP POLICY IF EXISTS "reconciliations_select" ON public.reconciliations;
CREATE POLICY "reconciliations_select" ON public.reconciliations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_executions pe
      WHERE pe.id = reconciliations.project_execution_id
      AND (
        has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role)
        OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)
      )
    )
  );

-- Fix 3: Fix overpermissive storage policies for proposal-files
-- Drop the overpermissive policies
DROP POLICY IF EXISTS "proponente views own proposal files" ON storage.objects;
DROP POLICY IF EXISTS "proponente deletes own proposal files" ON storage.objects;

-- Recreate with proper ownership checks
CREATE POLICY "proponente views own proposal files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'proposal-files'
    AND (
      -- Owner can view
      EXISTS (
        SELECT 1 FROM proposal_files pf
        JOIN proposals p ON p.id = pf.proposal_id
        WHERE pf.file_path = name
        AND p.proponente_user_id = auth.uid()
      )
      -- Org staff can view
      OR EXISTS (
        SELECT 1 FROM proposal_files pf
        JOIN proposals p ON p.id = pf.proposal_id
        WHERE pf.file_path = name
        AND (
          has_org_role(auth.uid(), p.organization_id, 'org_admin'::app_role)
          OR has_org_role(auth.uid(), p.organization_id, 'edital_manager'::app_role)
          OR has_role(auth.uid(), 'icca_admin'::app_role)
        )
      )
      -- Assigned reviewer can view
      OR EXISTS (
        SELECT 1 FROM proposal_files pf
        JOIN review_assignments ra ON ra.proposal_id = pf.proposal_id
        WHERE pf.file_path = name
        AND ra.reviewer_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "proponente deletes own proposal files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'proposal-files'
    AND EXISTS (
      SELECT 1 FROM proposal_files pf
      JOIN proposals p ON p.id = pf.proposal_id
      WHERE pf.file_path = name
      AND p.proponente_user_id = auth.uid()
      AND p.status = 'draft'
    )
  );
