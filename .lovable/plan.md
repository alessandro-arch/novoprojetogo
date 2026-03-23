

## Plan: Fomento Authentication Flow

### 1. Database Migration
Add `fomento_role` column to existing `profiles` table using a validation trigger (not CHECK constraint, per Supabase guidelines):

```sql
ALTER TABLE public.profiles ADD COLUMN fomento_role text DEFAULT NULL;

-- Validation trigger instead of CHECK
CREATE OR REPLACE FUNCTION public.validate_fomento_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fomento_role IS NOT NULL AND NEW.fomento_role NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'fomento_role must be admin, gestor, or NULL';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fomento_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_fomento_role();
```

### 2. New: `src/contexts/FomentoContext.tsx`
A lightweight context that tracks the active module (`'projetogo' | 'fomento'`) and the user's `fomento_role`. Provides:
- `activeModule` state
- `fomentoRole` (fetched from profiles after login)
- `setActiveModule()` to switch context

### 3. Rewrite: `src/pages/fomento/FomentoLogin.tsx`
Full login form matching `/login` visual style but with:
- `TrendingUp` icon + "ProjetoGO Fomento" title
- `Badge` "PRPPGE · UVV" below logo
- Dark blue button (`bg-[#1e3a5f]`) instead of default `variant="dark"`
- "Voltar ao inicio" link → `/`
- On successful login: query `profiles.fomento_role` for the user
  - If role exists → set `activeModule='fomento'`, navigate to `/fomento/dashboard`
  - If null → show error toast, sign out, stay on page

### 4. New: `src/components/FomentoProtectedRoute.tsx`
Similar to `ProtectedRoute` but:
- Redirects unauthenticated users to `/fomento/login` (not `/login`)
- Checks `fomento_role` from profiles query; if null → redirect to `/fomento/login`
- Uses the shared `useAuth` for session/user state

### 5. New: `src/pages/fomento/FomentoDashboard.tsx`
Minimal placeholder page showing "Fomento Dashboard" with the user's role badge and a sign-out button.

### 6. Update: `src/App.tsx`
- Wrap all routes with `FomentoProvider`
- Add fomento routes:
  - `/fomento/login` → `<FomentoLogin />` (public)
  - `/fomento/dashboard` → `<FomentoProtectedRoute><FomentoDashboard /></FomentoProtectedRoute>`
  - `/fomento/*` → `<FomentoProtectedRoute>...</FomentoProtectedRoute>` (catch-all for future)

### 7. Update: `src/contexts/AuthContext.tsx`
- Add `fomentoRole: string | null` to context
- Fetch `fomento_role` from profiles alongside existing role fetching in `fetchRoles`
- Expose in provider value

### Files changed/created
| File | Action |
|------|--------|
| Migration SQL | Add `fomento_role` + validation trigger |
| `src/contexts/AuthContext.tsx` | Add `fomentoRole` field |
| `src/pages/fomento/FomentoLogin.tsx` | Rewrite with full login form |
| `src/components/FomentoProtectedRoute.tsx` | Create |
| `src/pages/fomento/FomentoDashboard.tsx` | Create placeholder |
| `src/App.tsx` | Add fomento protected routes |

### What stays untouched
- `/login`, `/register`, `/dashboard` and all existing ProjetoGO routes
- Existing `ProtectedRoute` component
- All other tables and RLS policies

