

## Fix: Update `validate_fomento_role` trigger to accept `superadmin`

The error is clear: the `validate_fomento_role()` trigger function still only allows `'admin'` and `'gestor'`. It was never updated to accept `'superadmin'`.

### Database Migration

One migration to update the function:

```sql
CREATE OR REPLACE FUNCTION public.validate_fomento_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fomento_role IS NOT NULL 
     AND NEW.fomento_role NOT IN ('superadmin', 'admin', 'gestor') THEN
    RAISE EXCEPTION 'fomento_role must be superadmin, admin, gestor, or NULL';
  END IF;
  RETURN NEW;
END;
$function$;
```

Also update `set_fomento_role` to accept `'superadmin'`:

```sql
CREATE OR REPLACE FUNCTION public.set_fomento_role(...)
-- Add 'superadmin' to the allowed values check
```

And update `has_fomento_admin` to also match `'superadmin'` so superadmins retain admin-level access for RLS policies.

### Files Changed

| File | Change |
|---|---|
| 1 SQL migration | Update 3 functions to recognize `superadmin` |

No frontend changes needed — this is purely a database-side fix.

