-- Permite autenticar para exibir a mensagem correta, mas bloqueia os dados via RLS.
create or replace function public.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and (membership.role = 'owner' or membership.access_status = 'active')
  );
$function$;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
      and (membership.role = 'owner' or membership.access_status = 'active')
  );
$function$;

create or replace function public.is_org_editor(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'member')
      and (membership.role = 'owner' or membership.access_status = 'active')
  );
$function$;

create or replace function public.can_view_operations(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'viewer')
      and (membership.role = 'owner' or membership.access_status = 'active')
  );
$function$;

create or replace function public.member_module_access(p_organization_id uuid, p_module text)
returns text language sql stable security definer set search_path = '' as $function$
  select case
    when membership.role = 'owner' then 'edit'
    when membership.access_status <> 'active' then 'none'
    when membership.module_permissions ? p_module
      and membership.module_permissions ->> p_module in ('none', 'view', 'edit')
      then membership.module_permissions ->> p_module
    when membership.role = 'admin' and p_module <> 'users' then 'edit'
    when membership.role = 'member' and p_module in ('dashboard','orcamentos','clientes_catalogo') then 'edit'
    when membership.role = 'viewer' and p_module <> 'users' then 'view'
    else 'none'
  end
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = auth.uid()
  limit 1;
$function$;

-- Remove o bloqueio técnico antigo; a situação comercial permanece na associação.
update auth.users
set banned_until = null,
    updated_at = now()
where lower(email) = '1000beatssonorizacao@gmail.com';

