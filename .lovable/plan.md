

## Plan: Replace Landing Page with Module Selector

### What changes

1. **Rewrite `src/pages/Index.tsx`** — Replace the current multi-section landing page with a clean module selector page containing:
   - Centered "ProjetoGO" logo (FileText icon + text) at top
   - Subtitle "Selecione o módulo que deseja acessar"
   - Two cards in a responsive grid (side-by-side on desktop, stacked on mobile):
     - **ProjetoGO** card: FileText icon, description, "Acessar" button → `/login`
     - **ProjetoGO Fomento** card: TrendingUp icon, description, "PRPPGE · UVV" badge, "Acessar" button → `/fomento/login`
   - Uses existing design tokens (navy bg accents, Plus Jakarta Sans, rounded-xl cards, `dark` button variant)

2. **Add route `/fomento/login`** in `src/App.tsx` — A simple placeholder page (or redirect target) so the link doesn't 404. Will create a minimal `src/pages/fomento/FomentoLogin.tsx` placeholder.

### What stays untouched
- `/login` page and all other routes
- All existing landing section components (kept in codebase, just no longer imported by Index)
- All internal panels, auth flow, Supabase integration

### Technical details
- Cards use existing `Card` component with hover shadow transition
- Badge uses existing `Badge` component
- Responsive: `grid-cols-1 md:grid-cols-2` layout
- Background: `bg-background` (clean white, matching current style)
- Navigation via `useNavigate`

