

## Plan: Create Fomento Database Tables

### 1. Security Definer Function
Create a `has_fomento_role` function (SECURITY DEFINER) to check if a user has any fomento_role, and a `has_fomento_admin` variant for admin-only checks. This avoids recursive RLS on the profiles table.

```sql
CREATE OR REPLACE FUNCTION public.has_fomento_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND fomento_role IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.has_fomento_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND fomento_role = 'admin'
  )
$$;
```

### 2. Create Tables
Three tables using validation triggers (not CHECK constraints) per Supabase guidelines:

- **fomento_projects** — main project table with all specified columns. Uses `created_by uuid` (no FK to auth.users per project conventions).
- **fomento_rubricas** — budget line items, FK to fomento_projects with CASCADE delete.
- **fomento_team** — team members, FK to fomento_projects with CASCADE delete.

Validation triggers for `fonte`, `natureza`, `area`, `vinculo_academico`, and `status` columns instead of CHECK constraints.

### 3. RLS Policies

**fomento_projects:**
- SELECT/INSERT/UPDATE: `has_fomento_access(auth.uid())`
- DELETE: `has_fomento_admin(auth.uid())`

**fomento_rubricas & fomento_team:**
- ALL: `has_fomento_access(auth.uid())`

### 4. Updated_at Trigger
Reuse existing `update_updated_at_column()` function for fomento_projects.

### Files changed
| File | Action |
|------|--------|
| Migration SQL | Create functions, tables, triggers, RLS policies |

### What stays untouched
- All existing tables including profiles
- All existing RLS policies
- All frontend code (no changes needed for this migration)

### Technical details
- Security definer functions prevent recursive RLS when querying profiles
- Validation triggers used instead of CHECK constraints (Supabase guideline)
- `created_by` stored as plain uuid without FK to auth.users (project convention)

