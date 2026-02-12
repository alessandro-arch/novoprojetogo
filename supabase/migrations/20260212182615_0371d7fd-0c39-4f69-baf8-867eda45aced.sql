
-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_form_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_submission_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edital_submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_reviewer_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_knowledge_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_response_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_reveals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnpq_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. PUBLIC / REFERENCE TABLES (read-only for all authenticated)
-- ============================================================
CREATE POLICY "cnpq_areas_select" ON public.cnpq_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "institutions_select" ON public.institutions FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. PROFILES
-- ============================================================
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. USER_ROLES (only self-read, managed by system/admin)
-- ============================================================
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_admin_select" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'icca_admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'icca_admin'));

-- ============================================================
-- 5. ORGANIZATIONS
-- ============================================================
CREATE POLICY "orgs_select_member" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "orgs_admin_all" ON public.organizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'icca_admin'));

-- ============================================================
-- 6. ORGANIZATION_MEMBERS
-- ============================================================
CREATE POLICY "org_members_select" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_members_insert_own" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "org_members_admin_manage" ON public.organization_members FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'org_admin'));

-- ============================================================
-- 7. EDITAIS
-- ============================================================
CREATE POLICY "editais_public_select" ON public.editais FOR SELECT TO authenticated USING (is_public = true AND deleted_at IS NULL);
CREATE POLICY "editais_org_select" ON public.editais FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id) AND deleted_at IS NULL);
CREATE POLICY "editais_org_admin_manage" ON public.editais FOR INSERT TO authenticated WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'org_admin') OR public.has_org_role(auth.uid(), organization_id, 'edital_manager'));
CREATE POLICY "editais_org_admin_update" ON public.editais FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'org_admin') OR public.has_org_role(auth.uid(), organization_id, 'edital_manager'));
CREATE POLICY "editais_org_admin_delete" ON public.editais FOR DELETE TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'org_admin'));

-- ============================================================
-- 8. EDITAL_AREAS
-- ============================================================
CREATE POLICY "edital_areas_select" ON public.edital_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "edital_areas_manage" ON public.edital_areas FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.editais e WHERE e.id = edital_id AND (public.has_org_role(auth.uid(), e.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), e.organization_id, 'edital_manager')))
);

-- ============================================================
-- 9. EDITAL_FORMS & FORM SCHEMAS
-- ============================================================
CREATE POLICY "edital_forms_select" ON public.edital_forms FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "edital_forms_manage" ON public.edital_forms FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'org_admin') OR public.has_org_role(auth.uid(), organization_id, 'edital_manager'));

CREATE POLICY "edital_form_schemas_select" ON public.edital_form_schemas FOR SELECT TO authenticated USING (true);
CREATE POLICY "edital_form_schemas_manage" ON public.edital_form_schemas FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.editais e WHERE e.id = edital_id AND (public.has_org_role(auth.uid(), e.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), e.organization_id, 'edital_manager')))
);

-- ============================================================
-- 10. SUBMISSIONS & DRAFTS
-- ============================================================
CREATE POLICY "submissions_select_own" ON public.edital_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "submissions_org_select" ON public.edital_submissions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.editais e WHERE e.id = edital_id AND public.is_org_member(auth.uid(), e.organization_id))
);
CREATE POLICY "submissions_insert_own" ON public.edital_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "submissions_update_own" ON public.edital_submissions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "drafts_select_own" ON public.edital_submission_drafts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "drafts_insert_own" ON public.edital_submission_drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "drafts_update_own" ON public.edital_submission_drafts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "drafts_delete_own" ON public.edital_submission_drafts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sub_files_select" ON public.edital_submission_files FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.edital_submissions s WHERE s.id = submission_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.editais e WHERE e.id = s.edital_id AND public.is_org_member(auth.uid(), e.organization_id))))
);
CREATE POLICY "sub_files_insert_own" ON public.edital_submission_files FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.edital_submissions s WHERE s.id = submission_id AND s.user_id = auth.uid())
);

-- ============================================================
-- 11. PROPOSALS
-- ============================================================
CREATE POLICY "proposals_select_own" ON public.proposals FOR SELECT TO authenticated USING (auth.uid() = proponente_user_id);
CREATE POLICY "proposals_org_select" ON public.proposals FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "proposals_insert_own" ON public.proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = proponente_user_id);
CREATE POLICY "proposals_update_own" ON public.proposals FOR UPDATE TO authenticated USING (auth.uid() = proponente_user_id);

CREATE POLICY "proposal_answers_select" ON public.proposal_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND (p.proponente_user_id = auth.uid() OR public.is_org_member(auth.uid(), p.organization_id) OR public.is_reviewer_assigned(auth.uid(), p.id)))
);
CREATE POLICY "proposal_answers_insert" ON public.proposal_answers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.proponente_user_id = auth.uid())
);
CREATE POLICY "proposal_answers_update" ON public.proposal_answers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.proponente_user_id = auth.uid())
);

CREATE POLICY "proposal_files_select" ON public.proposal_files FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND (p.proponente_user_id = auth.uid() OR public.is_org_member(auth.uid(), p.organization_id) OR public.is_reviewer_assigned(auth.uid(), p.id)))
);
CREATE POLICY "proposal_files_insert" ON public.proposal_files FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.proponente_user_id = auth.uid())
);

CREATE POLICY "proposal_decisions_select" ON public.proposal_decisions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND (p.proponente_user_id = auth.uid() OR public.is_org_member(auth.uid(), p.organization_id)))
);
CREATE POLICY "proposal_decisions_insert" ON public.proposal_decisions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND public.is_org_member(auth.uid(), p.organization_id))
);

-- ============================================================
-- 12. FORMS LIBRARY
-- ============================================================
CREATE POLICY "forms_select" ON public.forms FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "forms_manage" ON public.forms FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'org_admin') OR public.has_org_role(auth.uid(), organization_id, 'edital_manager'));

CREATE POLICY "form_fields_select" ON public.form_fields FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND public.is_org_member(auth.uid(), f.organization_id))
);
CREATE POLICY "form_fields_manage" ON public.form_fields FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND (public.has_org_role(auth.uid(), f.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), f.organization_id, 'edital_manager')))
);

CREATE POLICY "form_sections_select" ON public.form_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_sections_manage" ON public.form_sections FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.edital_forms ef WHERE ef.id = form_id AND (public.has_org_role(auth.uid(), ef.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), ef.organization_id, 'edital_manager')))
);

CREATE POLICY "form_questions_select" ON public.form_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_questions_manage" ON public.form_questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.edital_forms ef WHERE ef.id = form_id AND (public.has_org_role(auth.uid(), ef.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), ef.organization_id, 'edital_manager')))
);

CREATE POLICY "form_question_options_select" ON public.form_question_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_question_options_manage" ON public.form_question_options FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.form_questions fq JOIN public.edital_forms ef ON ef.id = fq.form_id WHERE fq.id = question_id AND (public.has_org_role(auth.uid(), ef.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), ef.organization_id, 'edital_manager')))
);

CREATE POLICY "form_knowledge_areas_select" ON public.form_knowledge_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_knowledge_areas_manage" ON public.form_knowledge_areas FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.edital_forms ef WHERE ef.id = form_id AND (public.has_org_role(auth.uid(), ef.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), ef.organization_id, 'edital_manager')))
);

CREATE POLICY "form_versions_select" ON public.form_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_versions_manage" ON public.form_versions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND (public.has_org_role(auth.uid(), f.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), f.organization_id, 'edital_manager')))
);

CREATE POLICY "form_response_drafts_select_own" ON public.form_response_drafts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "form_response_drafts_insert_own" ON public.form_response_drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "form_response_drafts_update_own" ON public.form_response_drafts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "form_response_drafts_delete_own" ON public.form_response_drafts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 13. KNOWLEDGE AREAS & SCORING CRITERIA
-- ============================================================
CREATE POLICY "knowledge_areas_select" ON public.knowledge_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "knowledge_areas_manage" ON public.knowledge_areas FOR ALL TO authenticated USING (public.has_org_role(auth.uid(), organization_id, 'org_admin') OR public.has_org_role(auth.uid(), organization_id, 'edital_manager'));

CREATE POLICY "scoring_criteria_select" ON public.scoring_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "scoring_criteria_manage" ON public.scoring_criteria FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.editais e WHERE e.id = edital_id AND (public.has_org_role(auth.uid(), e.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), e.organization_id, 'edital_manager')))
);

-- ============================================================
-- 14. REVIEWERS & REVIEW SYSTEM
-- ============================================================
CREATE POLICY "reviewers_org_select" ON public.reviewers FOR SELECT TO authenticated USING (
  public.is_org_member(auth.uid(), org_id)
);
CREATE POLICY "reviewers_manage" ON public.reviewers FOR ALL TO authenticated USING (
  public.has_org_role(auth.uid(), org_id, 'org_admin') OR public.has_org_role(auth.uid(), org_id, 'edital_manager')
);

CREATE POLICY "reviewer_profiles_select_own" ON public.reviewer_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reviewer_profiles_org_select" ON public.reviewer_profiles FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "reviewer_profiles_insert_own" ON public.reviewer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviewer_profiles_update_own" ON public.reviewer_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "reviewer_invites_org_select" ON public.reviewer_invites FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "reviewer_invites_manage" ON public.reviewer_invites FOR ALL TO authenticated USING (
  public.has_org_role(auth.uid(), org_id, 'org_admin') OR public.has_org_role(auth.uid(), org_id, 'edital_manager')
);

CREATE POLICY "reviewer_conflicts_org_select" ON public.reviewer_conflicts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "reviewer_conflicts_manage" ON public.reviewer_conflicts FOR ALL TO authenticated USING (
  public.has_org_role(auth.uid(), org_id, 'org_admin') OR public.has_org_role(auth.uid(), org_id, 'edital_manager')
);

CREATE POLICY "proposal_reviewer_conflicts_select" ON public.proposal_reviewer_conflicts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "proposal_reviewer_conflicts_manage" ON public.proposal_reviewer_conflicts FOR ALL TO authenticated USING (
  public.has_org_role(auth.uid(), org_id, 'org_admin') OR public.has_org_role(auth.uid(), org_id, 'edital_manager')
);

CREATE POLICY "review_assignments_reviewer_select" ON public.review_assignments FOR SELECT TO authenticated USING (auth.uid() = reviewer_user_id);
CREATE POLICY "review_assignments_org_select" ON public.review_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND public.is_org_member(auth.uid(), p.organization_id))
);
CREATE POLICY "review_assignments_manage" ON public.review_assignments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND (public.has_org_role(auth.uid(), p.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), p.organization_id, 'edital_manager')))
);

CREATE POLICY "reviews_reviewer_select" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() = reviewer_user_id);
CREATE POLICY "reviews_org_select" ON public.reviews FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND public.is_org_member(auth.uid(), p.organization_id))
);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_user_id);
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_user_id);

CREATE POLICY "review_scores_select" ON public.review_scores FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND (r.reviewer_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = r.proposal_id AND public.is_org_member(auth.uid(), p.organization_id))))
);
CREATE POLICY "review_scores_insert" ON public.review_scores FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.reviewer_user_id = auth.uid())
);
CREATE POLICY "review_scores_update" ON public.review_scores FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.reviewer_user_id = auth.uid())
);

CREATE POLICY "identity_reveals_org_select" ON public.identity_reveals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.editais e WHERE e.id = edital_id AND public.is_org_member(auth.uid(), e.organization_id))
);
CREATE POLICY "identity_reveals_insert" ON public.identity_reveals FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.editais e WHERE e.id = edital_id AND (public.has_org_role(auth.uid(), e.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), e.organization_id, 'edital_manager')))
);

-- ============================================================
-- 15. AUDIT LOGS (read-only for org admins, insert via trigger)
-- ============================================================
CREATE POLICY "audit_logs_org_select" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.is_org_member(auth.uid(), organization_id) AND (
    public.has_org_role(auth.uid(), organization_id, 'org_admin') OR public.has_role(auth.uid(), 'icca_admin')
  )
);
CREATE POLICY "audit_logs_insert_system" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 16. FINANCIAL TABLES
-- ============================================================
CREATE POLICY "project_executions_org_select" ON public.project_executions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "project_executions_manage" ON public.project_executions FOR ALL TO authenticated USING (
  public.has_org_role(auth.uid(), organization_id, 'org_admin') OR public.has_org_role(auth.uid(), organization_id, 'edital_manager')
);

CREATE POLICY "project_bank_accounts_select" ON public.project_bank_accounts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND public.is_org_member(auth.uid(), pe.organization_id))
);
CREATE POLICY "project_bank_accounts_manage" ON public.project_bank_accounts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND (public.has_org_role(auth.uid(), pe.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), pe.organization_id, 'edital_manager')))
);

CREATE POLICY "project_expenses_select" ON public.project_expenses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND public.is_org_member(auth.uid(), pe.organization_id))
);
CREATE POLICY "project_expenses_manage" ON public.project_expenses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND (public.has_org_role(auth.uid(), pe.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), pe.organization_id, 'edital_manager')))
);

CREATE POLICY "project_refunds_select" ON public.project_refunds FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND public.is_org_member(auth.uid(), pe.organization_id))
);
CREATE POLICY "project_refunds_manage" ON public.project_refunds FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND (public.has_org_role(auth.uid(), pe.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), pe.organization_id, 'edital_manager')))
);

CREATE POLICY "bank_statements_select" ON public.bank_statements FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND public.is_org_member(auth.uid(), pe.organization_id))
);
CREATE POLICY "bank_statements_manage" ON public.bank_statements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND (public.has_org_role(auth.uid(), pe.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), pe.organization_id, 'edital_manager')))
);

CREATE POLICY "bank_transactions_select" ON public.bank_transactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bank_statements bs JOIN public.project_executions pe ON pe.id = bs.project_execution_id WHERE bs.id = bank_statement_id AND public.is_org_member(auth.uid(), pe.organization_id))
);
CREATE POLICY "bank_transactions_manage" ON public.bank_transactions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bank_statements bs JOIN public.project_executions pe ON pe.id = bs.project_execution_id WHERE bs.id = bank_statement_id AND (public.has_org_role(auth.uid(), pe.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), pe.organization_id, 'edital_manager')))
);

CREATE POLICY "expense_payments_select" ON public.expense_payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_expenses ex JOIN public.project_executions pe ON pe.id = ex.project_execution_id WHERE ex.id = expense_id AND public.is_org_member(auth.uid(), pe.organization_id))
);
CREATE POLICY "expense_payments_manage" ON public.expense_payments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_expenses ex JOIN public.project_executions pe ON pe.id = ex.project_execution_id WHERE ex.id = expense_id AND (public.has_org_role(auth.uid(), pe.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), pe.organization_id, 'edital_manager')))
);

CREATE POLICY "reconciliations_select" ON public.reconciliations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND public.is_org_member(auth.uid(), pe.organization_id))
);
CREATE POLICY "reconciliations_manage" ON public.reconciliations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.project_executions pe WHERE pe.id = project_execution_id AND (public.has_org_role(auth.uid(), pe.organization_id, 'org_admin') OR public.has_org_role(auth.uid(), pe.organization_id, 'edital_manager')))
);
