-- Teste da regra de dominio (roda em Postgres descartavel; NAO rodar em producao).
-- Cria stubs minimos das tabelas e executa a migration 20261024110000.
create role anon; create role authenticated;
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create type public.app_role as enum ('icca_admin','org_admin','edital_manager','proponente','reviewer');
create table public.organizations (id uuid primary key, domain text);
create table public.profiles (user_id uuid primary key, fomento_role text);
create table public.user_roles (user_id uuid, role public.app_role);
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable as
  $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create table public.organization_members (id uuid default gen_random_uuid(), user_id uuid, organization_id uuid, role public.app_role);
create table public.sd_members (id uuid default gen_random_uuid(), user_id uuid, organization_id uuid, role text, status text);
create table public.sd_faculty (id uuid default gen_random_uuid(), user_id uuid, organization_id uuid);
create table public.sd_students (id uuid default gen_random_uuid(), user_id uuid, organization_id uuid);

insert into public.organizations values ('00000000-0000-0000-0000-0000000000a1','uvv.br'), ('00000000-0000-0000-0000-0000000000b2', null);
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001','prof@uvv.br'),
 ('00000000-0000-0000-0000-000000000002','prof@gmail.com'),
 ('00000000-0000-0000-0000-000000000003','aluno@gmail.com'),
 ('00000000-0000-0000-0000-000000000004','admin@icca.org.br'),
 ('00000000-0000-0000-0000-000000000005','super@icca.org.br'),
 ('00000000-0000-0000-0000-000000000006','Prof.Maiusc@UVV.BR');
insert into public.user_roles values ('00000000-0000-0000-0000-000000000004','icca_admin');
insert into public.profiles values ('00000000-0000-0000-0000-000000000005','superadmin');
-- vinculo ja existente fora da regra, criado ANTES da migration (nao deve ser afetado)
insert into public.sd_members (user_id, organization_id, role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','admin');

\i supabase/migrations/20261024110000_staff_email_domain_rule.sql

create table public.t_result (caso text, esperado text, obtido text);
create function public.t_try(_caso text, _esperado text, _sql text) returns void language plpgsql as $$
declare o text := 'permitido';
begin
  begin execute _sql; exception when check_violation then o := 'bloqueado'; end;
  insert into public.t_result values (_caso, _esperado, o);
end $$;

select public.t_try('1 org_admin uvv.br','permitido',$$insert into organization_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','org_admin')$$);
select public.t_try('2 org_admin gmail','bloqueado',$$insert into organization_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','org_admin')$$);
select public.t_try('3 edital_manager gmail','bloqueado',$$insert into organization_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','edital_manager')$$);
select public.t_try('4 proponente gmail','permitido',$$insert into organization_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','proponente')$$);
select public.t_try('5 reviewer gmail','permitido',$$insert into organization_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','reviewer')$$);
select public.t_try('6 icca_admin excecao','permitido',$$insert into organization_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a1','org_admin')$$);
select public.t_try('7 superadmin excecao','permitido',$$insert into sd_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000a1','admin')$$);
select public.t_try('8 sd_members gmail','bloqueado',$$insert into sd_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','executor')$$);
select public.t_try('9 sd_faculty gmail','bloqueado',$$insert into sd_faculty(user_id,organization_id) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1')$$);
select public.t_try('10 sd_faculty uvv.br maiusculo','permitido',$$insert into sd_faculty(user_id,organization_id) values ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000a1')$$);
select public.t_try('11 sd_students gmail (aluno livre)','permitido',$$insert into sd_students(user_id,organization_id) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1')$$);
select public.t_try('12 org sem restricao','permitido',$$insert into sd_members(user_id,organization_id,role) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b2','admin')$$);
select public.t_try('13 vinculo pre-existente externo: update de status nao dispara','permitido',$$update sd_members set status='ativo' where user_id='00000000-0000-0000-0000-000000000002'$$);
select public.t_try('14 promover papel de membro externo existente','bloqueado',$$update sd_members set role='executor' where user_id='00000000-0000-0000-0000-000000000002'$$);
select caso, esperado, obtido, case when esperado=obtido then 'OK' else 'FALHOU' end as resultado from public.t_result order by 1;
