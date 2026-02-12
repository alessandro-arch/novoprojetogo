
-- 1) Stub: project_executions (links a proposal to its financial execution)
CREATE TABLE public.project_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  edital_id UUID NOT NULL REFERENCES public.editais(id),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  total_budget NUMERIC(15,2) DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own executions" ON public.project_executions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = project_executions.proposal_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = project_executions.proposal_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org executions" ON public.project_executions
  FOR SELECT USING (
    has_org_role(auth.uid(), organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role)
  );
CREATE POLICY "icca_admin full access executions" ON public.project_executions
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 2) Stub: project_expenses
CREATE TABLE public.project_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_execution_id UUID NOT NULL REFERENCES public.project_executions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  supplier_name TEXT,
  supplier_document TEXT,
  invoice_number TEXT,
  issue_date DATE,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own expenses" ON public.project_expenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = project_expenses.project_execution_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = project_expenses.project_execution_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org expenses" ON public.project_expenses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_executions pe WHERE pe.id = project_expenses.project_execution_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))
  );
CREATE POLICY "icca_admin full access expenses" ON public.project_expenses
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 3) Stub: project_refunds
CREATE TABLE public.project_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_execution_id UUID NOT NULL REFERENCES public.project_executions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  refund_date DATE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own refunds" ON public.project_refunds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = project_refunds.project_execution_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = project_refunds.project_execution_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org refunds" ON public.project_refunds
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_executions pe WHERE pe.id = project_refunds.project_execution_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))
  );
CREATE POLICY "icca_admin full access refunds" ON public.project_refunds
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 4) project_bank_accounts
CREATE TABLE public.project_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_execution_id UUID NOT NULL REFERENCES public.project_executions(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  branch_number TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'corrente',
  account_holder_name TEXT NOT NULL,
  account_holder_document TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own bank accounts" ON public.project_bank_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = project_bank_accounts.project_execution_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = project_bank_accounts.project_execution_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org bank accounts" ON public.project_bank_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_executions pe WHERE pe.id = project_bank_accounts.project_execution_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))
  );
CREATE POLICY "icca_admin full access bank accounts" ON public.project_bank_accounts
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 5) bank_statements
CREATE TABLE public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_execution_id UUID NOT NULL REFERENCES public.project_executions(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.project_bank_accounts(id) ON DELETE CASCADE,
  file_url TEXT,
  statement_period_start DATE,
  statement_period_end DATE,
  extraction_confidence_score NUMERIC(5,2),
  needs_review BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID NOT NULL,
  confirmed_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own statements" ON public.bank_statements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = bank_statements.project_execution_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = bank_statements.project_execution_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org statements" ON public.bank_statements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_executions pe WHERE pe.id = bank_statements.project_execution_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))
  );
CREATE POLICY "icca_admin full access statements" ON public.bank_statements
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 6) bank_transactions
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.project_bank_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  posting_date DATE,
  description_raw TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  direction TEXT NOT NULL DEFAULT 'debit',
  balance_after NUMERIC(15,2),
  document_id_reference TEXT,
  parsed_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own transactions" ON public.bank_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM bank_statements bs JOIN project_executions pe ON pe.id = bs.project_execution_id JOIN proposals p ON p.id = pe.proposal_id WHERE bs.id = bank_transactions.bank_statement_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM bank_statements bs JOIN project_executions pe ON pe.id = bs.project_execution_id JOIN proposals p ON p.id = pe.proposal_id WHERE bs.id = bank_transactions.bank_statement_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org transactions" ON public.bank_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bank_statements bs JOIN project_executions pe ON pe.id = bs.project_execution_id WHERE bs.id = bank_transactions.bank_statement_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))
  );
CREATE POLICY "icca_admin full access transactions" ON public.bank_transactions
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 7) reconciliations
CREATE TABLE public.reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_execution_id UUID NOT NULL REFERENCES public.project_executions(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.project_expenses(id) ON DELETE SET NULL,
  refund_id UUID REFERENCES public.project_refunds(id) ON DELETE SET NULL,
  bank_transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unmatched',
  match_rule TEXT,
  notes TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ
);
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own reconciliations" ON public.reconciliations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = reconciliations.project_execution_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = reconciliations.project_execution_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org reconciliations" ON public.reconciliations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_executions pe WHERE pe.id = reconciliations.project_execution_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))
  );
CREATE POLICY "icca_admin full access reconciliations" ON public.reconciliations
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- 8) expense_payments
CREATE TABLE public.expense_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.project_expenses(id) ON DELETE CASCADE,
  bank_transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  paid_amount NUMERIC(15,2) NOT NULL,
  paid_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proponente manages own payments" ON public.expense_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_expenses pe2 JOIN project_executions pe ON pe.id = pe2.project_execution_id JOIN proposals p ON p.id = pe.proposal_id WHERE pe2.id = expense_payments.expense_id AND p.proponente_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM project_expenses pe2 JOIN project_executions pe ON pe.id = pe2.project_execution_id JOIN proposals p ON p.id = pe.proposal_id WHERE pe2.id = expense_payments.expense_id AND p.proponente_user_id = auth.uid())
  );
CREATE POLICY "org staff sees org payments" ON public.expense_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_expenses pe2 JOIN project_executions pe ON pe.id = pe2.project_execution_id WHERE pe2.id = expense_payments.expense_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))
  );
CREATE POLICY "icca_admin full access payments" ON public.expense_payments
  FOR ALL USING (has_role(auth.uid(), 'icca_admin'::app_role));

-- Storage bucket for bank statement PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('bank-statements', 'bank-statements', false);

CREATE POLICY "proponente uploads bank statements" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'bank-statements' AND auth.uid() IS NOT NULL);

CREATE POLICY "proponente reads own bank statements" ON storage.objects
  FOR SELECT USING (bucket_id = 'bank-statements' AND auth.uid() IS NOT NULL);

-- Timestamp trigger for updated_at
CREATE TRIGGER update_project_executions_updated_at BEFORE UPDATE ON public.project_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_expenses_updated_at BEFORE UPDATE ON public.project_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_refunds_updated_at BEFORE UPDATE ON public.project_refunds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_bank_accounts_updated_at BEFORE UPDATE ON public.project_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
