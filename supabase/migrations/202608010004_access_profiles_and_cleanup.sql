-- 1K Beats v6.2.8: perfis de acesso, numeracao por empresa e limpeza recuperavel.

-- O backup fica fora da API publica e so pode ser lido pela service role.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.cleanup_archive (
  id bigint generated always as identity primary key,
  batch_id uuid not null,
  organization_id uuid not null,
  table_name text not null,
  row_data jsonb not null,
  archived_at timestamptz not null default now()
);
revoke all on private.cleanup_archive from public, anon, authenticated;

-- A limpeza e deliberadamente limitada a unica empresa desta instalacao.
-- Clientes, catalogo, configuracao, empresa e usuarios permanecem intactos.
do $migration$
declare
  v_organization_count integer;
  v_organization_id uuid;
  v_batch_id uuid := gen_random_uuid();
begin
  select count(*) into v_organization_count from public.organizations;
  if v_organization_count <> 1 then
    raise exception 'Limpeza cancelada: esperado 1 empresa, encontrado %.', v_organization_count;
  end if;

  select id into v_organization_id
  from public.organizations
  order by created_at
  limit 1;

  insert into private.cleanup_archive (batch_id, organization_id, table_name, row_data)
  select v_batch_id, v_organization_id, 'producoes', to_jsonb(row_data)
  from public.producoes row_data where organization_id = v_organization_id;
  insert into private.cleanup_archive (batch_id, organization_id, table_name, row_data)
  select v_batch_id, v_organization_id, 'equipe_diarias', to_jsonb(row_data)
  from public.equipe_diarias row_data where organization_id = v_organization_id;
  insert into private.cleanup_archive (batch_id, organization_id, table_name, row_data)
  select v_batch_id, v_organization_id, 'fornecedor_eventos', to_jsonb(row_data)
  from public.fornecedor_eventos row_data where organization_id = v_organization_id;
  insert into private.cleanup_archive (batch_id, organization_id, table_name, row_data)
  select v_batch_id, v_organization_id, 'gastos', to_jsonb(row_data)
  from public.gastos row_data where organization_id = v_organization_id;
  insert into private.cleanup_archive (batch_id, organization_id, table_name, row_data)
  select v_batch_id, v_organization_id, 'equipe', to_jsonb(row_data)
  from public.equipe row_data where organization_id = v_organization_id;
  insert into private.cleanup_archive (batch_id, organization_id, table_name, row_data)
  select v_batch_id, v_organization_id, 'fornecedores', to_jsonb(row_data)
  from public.fornecedores row_data where organization_id = v_organization_id;
  insert into private.cleanup_archive (batch_id, organization_id, table_name, row_data)
  select v_batch_id, v_organization_id, 'orcamentos', to_jsonb(row_data)
  from public.orcamentos row_data where organization_id = v_organization_id;

  delete from public.producoes where organization_id = v_organization_id;
  delete from public.equipe_diarias where organization_id = v_organization_id;
  delete from public.fornecedor_eventos where organization_id = v_organization_id;
  delete from public.gastos where organization_id = v_organization_id;
  delete from public.equipe where organization_id = v_organization_id;
  delete from public.fornecedores where organization_id = v_organization_id;
  delete from public.orcamentos where organization_id = v_organization_id;
end;
$migration$;

-- Novo perfil somente visualizacao.
alter table public.organization_members
  drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'member', 'viewer'));

-- Nesta primeira venda existe um unico usuario nao proprietario: Walter.
-- Ele inicia como gestor operacional e o owner pode mudar o perfil pela tela Usuarios.
update public.organization_members
set role = 'admin'
where role <> 'owner';

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
  );
$function$;

create or replace function public.is_org_editor(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'member')
  );
$function$;

create or replace function public.can_view_operations(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'viewer')
  );
$function$;

revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.is_org_editor(uuid) from public;
revoke all on function public.can_view_operations(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.is_org_editor(uuid) to authenticated;
grant execute on function public.can_view_operations(uuid) to authenticated;

-- Dados comerciais: todos os perfis visualizam; viewer nao altera.
drop policy if exists clientes_insert_member on public.clientes;
drop policy if exists clientes_update_member on public.clientes;
drop policy if exists clientes_delete_member on public.clientes;
create policy clientes_insert_editor on public.clientes
for insert to authenticated with check (public.is_org_editor(organization_id));
create policy clientes_update_editor on public.clientes
for update to authenticated
using (public.is_org_editor(organization_id))
with check (public.is_org_editor(organization_id));
create policy clientes_delete_admin on public.clientes
for delete to authenticated using (public.is_org_admin(organization_id));

drop policy if exists catalogo_insert_member on public.catalogo;
drop policy if exists catalogo_update_member on public.catalogo;
drop policy if exists catalogo_delete_member on public.catalogo;
create policy catalogo_insert_editor on public.catalogo
for insert to authenticated with check (public.is_org_editor(organization_id));
create policy catalogo_update_editor on public.catalogo
for update to authenticated
using (public.is_org_editor(organization_id))
with check (public.is_org_editor(organization_id));
create policy catalogo_delete_admin on public.catalogo
for delete to authenticated using (public.is_org_admin(organization_id));

drop policy if exists orcamentos_insert_member on public.orcamentos;
drop policy if exists orcamentos_update_member on public.orcamentos;
create policy orcamentos_insert_editor on public.orcamentos
for insert to authenticated with check (public.is_org_editor(organization_id));
create policy orcamentos_update_editor on public.orcamentos
for update to authenticated
using (public.is_org_editor(organization_id))
with check (public.is_org_editor(organization_id));

-- Somente o administrador principal ve e administra contas.
drop policy if exists members_select_same_org on public.organization_members;
create policy members_select_same_org on public.organization_members
for select to authenticated
using (user_id = auth.uid() or public.is_org_owner(organization_id));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_owner on public.organizations
for update to authenticated
using (public.is_org_owner(id))
with check (public.is_org_owner(id));

-- Operacao: owner/admin alteram; viewer pode apenas consultar.
do $policies$
declare
  v_table text;
begin
  foreach v_table in array array['equipe', 'equipe_diarias', 'fornecedores', 'fornecedor_eventos', 'gastos', 'producoes']
  loop
    execute format('drop policy if exists %I on public.%I', v_table || '_admin_all', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_select_operation', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_write_admin', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_view_operations(organization_id))',
      v_table || '_select_operation', v_table
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id))',
      v_table || '_write_admin', v_table
    );
  end loop;
end;
$policies$;

-- Cada empresa inicia sua propria sequencia de orcamentos em 0001.
create table if not exists public.organization_quote_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_number bigint not null default 1 check (next_number > 0)
);
alter table public.organization_quote_counters enable row level security;
revoke all on public.organization_quote_counters from public, anon, authenticated;

insert into public.organization_quote_counters (organization_id, next_number)
select organization_id, coalesce(max(numero), 0) + 1
from public.orcamentos
where organization_id is not null
group by organization_id
on conflict (organization_id) do update
set next_number = excluded.next_number;

create or replace function public.assign_organization_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_allocated bigint;
begin
  if new.organization_id is null then
    raise exception 'Empresa obrigatoria para numerar o orcamento.';
  end if;

  insert into public.organization_quote_counters (organization_id, next_number)
  values (new.organization_id, 2)
  on conflict (organization_id) do update
  set next_number = public.organization_quote_counters.next_number + 1
  returning next_number - 1 into v_allocated;

  new.numero := v_allocated;
  return new;
end;
$function$;

revoke all on function public.assign_organization_quote_number() from public, anon, authenticated;
drop trigger if exists orcamentos_assign_organization_number on public.orcamentos;
create trigger orcamentos_assign_organization_number
before insert on public.orcamentos
for each row execute function public.assign_organization_quote_number();

create unique index if not exists orcamentos_org_numero_unique_idx
on public.orcamentos(organization_id, numero)
where organization_id is not null;

analyze public.orcamentos;
analyze public.producoes;
analyze public.equipe;
analyze public.equipe_diarias;
analyze public.fornecedores;
analyze public.fornecedor_eventos;
analyze public.gastos;
