

## Plan: Full Fomento Module UI

This plan creates the complete Fomento module with sidebar navigation, dashboard with KPIs/charts, project CRUD with AI extraction, alerts page, and admin panel.

### Architecture

The module follows the same pattern as `OrgPanel`: a single `FomentoPanel` component using `PanelLayout` with internal nav state routing to sub-components. Routes in `App.tsx` point all `/fomento/*` to this panel (except `/fomento/login`).

```text
FomentoPanel (uses PanelLayout)
├── FomentoDashboardView   (dashboard)
├── FomentoProjectsList     (projetos)
├── FomentoProjectForm      (projetos/novo, projetos/:id/editar)
├── FomentoAlerts           (alertas)
└── FomentoAdmin            (admin, only fomento_role='admin')
```

### Files to create/modify

| File | Action |
|------|--------|
| `src/pages/fomento/FomentoPanel.tsx` | Create — main panel with PanelLayout + sidebar nav |
| `src/components/fomento/FomentoDashboardView.tsx` | Create — KPI cards + 4 Recharts charts + expiring table |
| `src/components/fomento/FomentoProjectsList.tsx` | Create — table with search/filters, CSV export, CRUD actions |
| `src/components/fomento/FomentoProjectForm.tsx` | Create — multi-section form with AI extraction, rubricas, team |
| `src/components/fomento/FomentoAlerts.tsx` | Create — KPI cards by urgency + filtered project list |
| `src/components/fomento/FomentoAdmin.tsx` | Create — user management table + invite form |
| `src/App.tsx` | Update — replace FomentoDashboard import with FomentoPanel |
| `src/pages/fomento/FomentoDashboard.tsx` | Delete (replaced by FomentoPanel) |

### 1. FomentoPanel.tsx

Uses `PanelLayout` with custom sidebar config:
- Logo: TrendingUp icon + "ProjetoGO Fomento" + Badge "PRPPGE · UVV"
- Nav items: Dashboard, Projetos, Alertas de Vigencia, Administracao (conditionally shown when `fomentoRole === 'admin'`)
- Footer: user name, role badge, Sair button (navigates to `/`)
- Internal state manages which view is active + sub-navigation (e.g., project form with ID)

Since PanelLayout already has logo/title/subtitle props and nav items, we'll extend it slightly or customize the sidebar content. The existing PanelLayout supports `title`, `subtitle`, and nav items — we'll use it as-is, adding the admin nav item conditionally.

For sign out, override to navigate to `/` instead of `/login`.

### 2. FomentoDashboardView.tsx

Fetches all `fomento_projects` and `fomento_rubricas` in one load:

**KPI Cards** (4 top-level + 4 area cards):
- Total Captado: sum of `valor_total`, green accent
- Projetos Ativos: count where `status = 'em_execucao'`
- Pesquisadores Unicos: `COUNT(DISTINCT pesquisador_principal)`
- Vencendo em 60d: projects where `vigencia_fim` is within 60 days, red if > 0

Area breakdown cards: count + sum for each `area` value.

**Charts** (Recharts):
- BarChart: top 10 researchers by total value
- PieChart: distribution by `orgao_financiador`
- BarChart: yearly evolution (group by `ano`)
- PieChart: by rubrica type (from `fomento_rubricas`)

**Table**: projects expiring within 90 days, sorted by `vigencia_fim` ASC.

### 3. FomentoProjectsList.tsx

- Fetches `fomento_projects` with client-side filtering
- Search by titulo/pesquisador
- Filters: area (select), status (select), fonte (select)
- Table columns: Processo UVV, Pesquisador, Titulo, Area, Fonte, Financiador, Status, Vigencia, Valor Total, Acoes
- Actions: Edit (navigates to form view), Delete (admin only, with AlertDialog confirmation)
- "Novo Projeto" button navigates to form view
- CSV export: generates CSV from filtered data and triggers download

### 4. FomentoProjectForm.tsx

Multi-section form using collapsible Card sections:

**[A] AI Extraction** (only for new projects):
- Anthropic API key input (persisted in localStorage as `fomento_anthropic_key`)
- PDF dropzone (drag-and-drop)
- On upload: convert to base64, POST to `https://api.anthropic.com/v1/messages` with the specified payload
- Parse JSON response and auto-fill form fields
- Status badge showing extraction result

**[B] Identification**: processo_uvv, pesquisador_principal*, orgao_financiador, titulo*, edital, ano

**[C] Classification**: fonte (radio), natureza (radio), area (radio with conditional tipo_servico), vinculo_academico (radio with conditional ppg_nome)

**[D] Financial**: valor_total (currency input), dynamic rubricas table (tipo + valor, add/remove rows)

**[E] Team**: dynamic team table (nome + funcao + email, add/remove), bolsistas inputs by category

**[F] Status & Dates**: data_assinatura, vigencia_inicio, vigencia_fim, status (select)

On submit: upsert to `fomento_projects`, then batch upsert `fomento_rubricas` and `fomento_team` (delete existing + re-insert).

### 5. FomentoAlerts.tsx

- KPI cards: Critical (<=30d, red), Attention (31-60d, yellow), Monitor (61-90d, blue)
- Filter buttons: 30 / 60 / 90 / 180 days
- List of `em_execucao` projects with `vigencia_fim` within selected range, sorted by days remaining
- Each item shows: titulo, pesquisador, financiador, valor, days remaining badge, edit button

### 6. FomentoAdmin.tsx

- Only accessible when `fomentoRole === 'admin'`
- Table of profiles with `fomento_role IS NOT NULL` — requires an edge function or RPC since profiles RLS only allows own-row select
- Actions: toggle between admin/gestor, remove fomento_role
- Invite form: email search → find profile → assign fomento_role

**RLS consideration**: The current `profiles` RLS only allows `SELECT` on own row. To list other users' fomento info, we need a `SECURITY DEFINER` function:

```sql
CREATE OR REPLACE FUNCTION public.list_fomento_users()
RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, email, full_name, fomento_role
  FROM public.profiles WHERE fomento_role IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.set_fomento_role(_target_user_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_fomento_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only fomento admins can manage roles';
  END IF;
  UPDATE public.profiles SET fomento_role = _role WHERE user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_profile_by_email(_email text)
RETURNS TABLE(user_id uuid, email text, full_name text, fomento_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, email, full_name, fomento_role
  FROM public.profiles WHERE email = _email LIMIT 1
$$;
```

### 7. App.tsx update

Replace the two fomento routes with:
```tsx
<Route path="/fomento/login" element={<FomentoLogin />} />
<Route path="/fomento/*" element={<FomentoProtectedRoute><FomentoPanel /></FomentoProtectedRoute>} />
```

### 8. PanelLayout customization

The existing PanelLayout's sign-out handler calls `window.location.replace("/login")`. For Fomento, we'll pass a custom `onSignOut` that navigates to `/` instead, using the panel's own sign-out logic (supabase.auth.signOut + navigate).

### Dependencies
- Recharts is likely already installed (used in OrgDashboard). Will verify.
- No new npm packages needed.

### Migration needed
One migration for the 3 admin RPC functions (`list_fomento_users`, `set_fomento_role`, `find_profile_by_email`).

