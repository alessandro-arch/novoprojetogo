create or replace function public.sd_members_signup_status(_org_id uuid)
returns table(user_id uuid, has_signed_in boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, (u.last_sign_in_at is not null) as has_signed_in
  from public.sd_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = _org_id
    and (public.sd_is_admin(auth.uid(), _org_id) or public.sd_is_superadmin(auth.uid()))
$$;

grant execute on function public.sd_members_signup_status(uuid) to authenticated;