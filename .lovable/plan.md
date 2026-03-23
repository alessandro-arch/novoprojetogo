

## Plan: URL-Based Routing for Fomento Module

Currently, FomentoPanel uses internal `useState` to switch views. This plan converts it to URL-based routing so each section has a proper URL path.

### Approach

Keep `FomentoPanel` as the layout wrapper (sidebar via `PanelLayout`), but derive `activeNav` from `useLocation().pathname` and use `useNavigate()` for sidebar clicks. Sub-views (project form new/edit) also use URL params.

### Changes

| File | Action |
|------|--------|
| `src/pages/fomento/FomentoPanel.tsx` | Rewrite — derive nav from URL, use navigate for nav changes, render views based on path |
| `src/App.tsx` | No change needed — `"/fomento/*"` wildcard already catches all sub-routes |

### FomentoPanel.tsx rewrite

```text
URL path                         → View rendered
/fomento/dashboard               → FomentoDashboardView
/fomento/projetos                 → FomentoProjectsList
/fomento/projetos/novo            → FomentoProjectForm (no projectId)
/fomento/projetos/:id/editar      → FomentoProjectForm (with projectId)
/fomento/alertas                  → FomentoAlerts
/fomento/admin                    → FomentoAdmin (admin only)
/fomento (bare)                   → redirect to /fomento/dashboard
```

**Key logic:**
- `const location = useLocation()` + `const navigate = useNavigate()`
- Extract path segment after `/fomento/` to determine active nav key
- `onNavChange` calls `navigate("/fomento/" + key)` instead of `setState`
- For project edit, extract ID from path via simple string parsing (no need for react-router params since it's under a wildcard)
- `onEditProject` navigates to `/fomento/projetos/{id}/editar`
- `onNewProject` navigates to `/fomento/projetos/novo`
- `onBack` (from form) navigates to `/fomento/projetos`
- Bare `/fomento` or `/fomento/` redirects to `/fomento/dashboard` via `Navigate`

The `PanelLayout` sidebar highlights the correct item because `activeNav` is derived from the URL. No changes to PanelLayout or child components needed — they already accept `onEditProject`/`onBack` callbacks.

### What stays untouched
- All child components (Dashboard, ProjectsList, ProjectForm, Alerts, Admin)
- PanelLayout component
- App.tsx routing
- FomentoAuthContext
- FomentoProtectedRoute

