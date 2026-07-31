-- Depois da migração dos dados legados, novos usuários só entram por convite/admin.
create or replace function public.bootstrap_organization(p_name text default '1000 Beats')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_name text := left(coalesce(nullif(trim(p_name), ''), '1000 Beats'), 120);
begin
  if v_user_id is null then raise exception 'authentication required'; end if;

  select organization_id into v_org_id
  from public.organization_members
  where user_id = v_user_id
  limit 1;
  if v_org_id is not null then return v_org_id; end if;

  if exists(select 1 from public.organizations) then
    raise exception 'organization membership required';
  end if;

  insert into public.organizations(name, slug, plan)
  values (v_name, lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6), 'professional')
  returning id into v_org_id;

  insert into public.organization_members(organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  update public.clientes set organization_id = v_org_id where organization_id is null;
  update public.catalogo set organization_id = v_org_id where organization_id is null;
  update public.config set organization_id = v_org_id where organization_id is null;
  update public.orcamentos
    set organization_id = v_org_id, created_by = coalesce(created_by, v_user_id)
    where organization_id is null;

  if not exists (select 1 from public.config where organization_id = v_org_id) then
    insert into public.config(organization_id, nome) values (v_org_id, v_name);
  end if;
  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_organization(text) from public;
grant execute on function public.bootstrap_organization(text) to authenticated;
