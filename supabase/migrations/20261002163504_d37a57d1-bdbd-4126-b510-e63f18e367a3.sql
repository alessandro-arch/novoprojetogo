create or replace function public.sd_check_vpn_eligibility(_enrollment text)
returns table (found boolean, role text, eligible boolean)
language sql
stable
security definer
set search_path = public
as $$
  with hit as (
    select 'aluno'::text as tipo,
           (s.status = 'ativo' and coalesce(s.service_desk_access_active, true)) as apto
    from public.sd_students s
    where btrim(s.enrollment) = btrim(_enrollment)
    union all
    select 'orientador'::text as tipo,
           (f.status = 'ativo') as apto
    from public.sd_faculty f
    where btrim(f.enrollment) = btrim(_enrollment)
  )
  select coalesce(bool_or(true), false),
         coalesce(max(hit.tipo), ''),
         coalesce(bool_or(hit.apto), false)
  from hit;
$$;

revoke all on function public.sd_check_vpn_eligibility(text) from public;
grant execute on function public.sd_check_vpn_eligibility(text) to anon, authenticated;