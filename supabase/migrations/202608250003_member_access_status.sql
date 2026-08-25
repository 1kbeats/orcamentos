-- Estados comerciais de acesso controlados exclusivamente pelo proprietário.
alter table public.organization_members
  add column if not exists access_status text not null default 'active';

alter table public.organization_members
  drop constraint if exists organization_members_access_status_check;
alter table public.organization_members
  add constraint organization_members_access_status_check
  check (access_status in ('active', 'activation_pending', 'suspended'));

update public.organization_members
set access_status = 'active'
where role = 'owner';

