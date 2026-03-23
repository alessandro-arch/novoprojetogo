

## Plan: Add "Resend Invite" Feature to Fomento Master Panel

### Summary
Add invite resend functionality with status tracking across the organization listing and edit screens, plus a new invite log table.

### Step 1: Create `fomento_invite_log` table (Migration)

```sql
CREATE TABLE public.fomento_invite_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES fomento_organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  enviado_por uuid NOT NULL
);

ALTER TABLE public.fomento_invite_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fomento_invite_log_select" ON public.fomento_invite_log
  FOR SELECT TO authenticated USING (has_fomento_admin(auth.uid()));

CREATE POLICY "fomento_invite_log_insert" ON public.fomento_invite_log
  FOR INSERT TO authenticated WITH CHECK (has_fomento_admin(auth.uid()));
```

### Step 2: Update Edge Function `invite-fomento-admin`

- Add support for `resend: true` flag in the request body
- When `resend` is true and user already exists, call `adminClient.auth.admin.inviteUserByEmail` again (Supabase allows re-inviting existing users)
- Log the invite to `fomento_invite_log` table on every successful invite (both new and resend)
- Return `{ success: true, resent: true }` for resend operations

### Step 3: Update `FomentoMasterPanel.tsx` - OrgListing

- Add `admin_user_id` check: if org has `admin_email` but admin has never logged in (we can check `last_sign_in_at` via the edge function response or a new field), show "Convite pendente" badge
- Add a "Reenviar Convite" button (Mail icon) next to Edit/Power buttons, visible when admin_email exists
- Button calls the `invite-fomento-admin` edge function with `resend: true`
- Shows toast on success

### Step 4: Update `FomentoMasterPanel.tsx` - OrgForm (Step 2)

- Add invite status indicator below the email field:
  - Query admin's `last_sign_in_at` via a new edge function endpoint or add `admin_status` field to `fomento_organizations`
  - Display colored badge: Convite pendente / Ativo / Inativo
- Add "Reenviar Convite" button
- Query `fomento_invite_log` for the org, display last 3 entries with formatted timestamps
- Show "Ultimo envio: DD/MM/YYYY as HH:MM" below the resend button

### Step 5: Add `admin_status` column to `fomento_organizations`

To track admin status without querying auth.users (which is not accessible client-side):

```sql
ALTER TABLE public.fomento_organizations 
  ADD COLUMN admin_status text NOT NULL DEFAULT 'pendente';
```

The edge function will:
- Set `admin_status = 'pendente'` on initial invite
- A trigger or the login flow will update to `'ativo'` on first access

Alternatively, the edge function can check `last_sign_in_at` from `auth.admin.getUserById()` and return the status in real-time.

### Technical Details

- **Edge function approach for status**: Since `auth.users.last_sign_in_at` is only accessible server-side, the edge function will check this when called and also return the admin's current auth status
- **Resend mechanism**: Supabase's `inviteUserByEmail` can be called again for existing users to resend the invitation email
- **Invite log**: Read via standard Supabase client query with RLS (fomento admin only)
- **Files modified**: `FomentoMasterPanel.tsx`, `invite-fomento-admin/index.ts`
- **New table**: `fomento_invite_log`

