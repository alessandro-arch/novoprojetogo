

## Bolsistas Module for ProjetoGO Fomento

### Overview

Create a full "Bolsistas" (scholarship holders) management module alongside the existing "Projetos" flow, including database table, listing page with filters, form with AI extraction, dashboard KPIs, and project-linked view.

### 1. Database Migration

**New table `fomento_bolsistas`** with all specified columns. Use validation trigger (not CHECK constraints) for `modalidade` and `status`, following project patterns.

- `valor_total` as `GENERATED ALWAYS AS (cotas_total * valor_mensal) STORED`
- `updated_at` trigger reusing `update_updated_at_column()`
- RLS policies mirroring `fomento_projects`: `has_fomento_access` for select/insert/update, `has_fomento_admin` for delete
- Validation trigger for `modalidade` IN ('ic','mestrado','doutorado','pos_doc','apoio_tecnico','extensao') and `status` IN ('ativo','suspenso','cancelado','concluido')

### 2. New Files

| File | Purpose |
|---|---|
| `src/components/fomento/FomentoBolsistasList.tsx` | List page with table, filters (modalidade, status, orientador), search, delete |
| `src/components/fomento/FomentoBolsistaForm.tsx` | Full form with AI extraction, sections A-I as specified, modalidade-based valor suggestion |

### 3. Modified Files

| File | Change |
|---|---|
| `src/pages/fomento/FomentoPanel.tsx` | Add "Bolsistas" nav item (GraduationCap icon) between Projetos and Alertas. Add routes: `/fomento/bolsistas`, `/fomento/bolsistas/novo`, `/fomento/bolsistas/:id/editar` |
| `src/components/fomento/FomentoDashboardView.tsx` | Add Bolsistas KPI section: total ativos, valor mensal total, donut by modalidade, bar by orientador |
| `src/components/fomento/FomentoProjectForm.tsx` | Add "Bolsistas Vinculados" section showing bolsistas linked to the project + button to add new bolsista pre-linked |
| `src/lib/fomento-utils.ts` | Add `MODALIDADE_LABELS`, `BOLSISTA_STATUS_LABELS`, `MODALIDADE_VALORES_SUGERIDOS` constants |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

### 4. AI Extraction for Bolsistas

Same pattern as project extraction (Anthropic Claude, PDF base64, retry logic). Different prompt extracting bolsista-specific fields. `valor_mensal` intentionally left blank for manual input.

### 5. Form Sections Detail

- **[A] Upload PDF** — AI extraction with same UX pattern
- **[B] Dados do Bolsista** — nome, email, CPF
- **[C] Dados Acadêmicos** — modalidade (select), orientador, coorientador, coordenador, PPG, título do plano, área
- **[D] Edital** — edital, órgão financiador, nº do termo
- **[E] Vigência** — cotas (meses), data início, data fim
- **[F] Valor** — modalidade-based suggestion (IC R$500, Mestrado R$2.100, Doutorado R$3.100, Pós-Doc R$5.200), editable valor_mensal, calculated valor_total
- **[G] Vínculo a Projeto** — optional select from fomento_projects
- **[H] Documentos** — reuse FomentoDocumentsSection pattern (store in fomento_documents with bolsista project_id reference)
- **[I] Status** — ativo/suspenso/cancelado/concluído

### 6. Dashboard Additions

Below existing charts, add a "Bolsistas" section with:
- 2 KPI cards: Total ativos, Valor mensal total
- Donut chart: distribution by modalidade
- Bar chart: bolsistas by orientador (top 10)

### 7. Project Form — Linked Bolsistas

In the project edit form, add a collapsible section "Bolsistas Vinculados" that queries `fomento_bolsistas` by `project_id` and displays a mini-table. Button "Novo Bolsista" navigates to `/fomento/bolsistas/novo?project_id=XXX`.

