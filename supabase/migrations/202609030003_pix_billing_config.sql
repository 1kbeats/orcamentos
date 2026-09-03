create table if not exists public.config_cobranca_sistema (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  pix_tipo text not null default 'cpf' check (pix_tipo in ('cpf','cnpj','email','telefone','aleatoria')),
  pix_chave text not null,
  favorecido text not null,
  cidade text not null,
  instituicao text,
  updated_at timestamptz not null default now()
);
drop trigger if exists config_cobranca_sistema_touch_updated_at on public.config_cobranca_sistema;
create trigger config_cobranca_sistema_touch_updated_at before update on public.config_cobranca_sistema for each row execute function public.touch_updated_at();
alter table public.config_cobranca_sistema enable row level security;
drop policy if exists config_cobranca_sistema_owner_select on public.config_cobranca_sistema;
create policy config_cobranca_sistema_owner_select on public.config_cobranca_sistema for select to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=config_cobranca_sistema.organization_id and m.user_id=auth.uid() and m.role='owner'));
drop policy if exists config_cobranca_sistema_owner_insert on public.config_cobranca_sistema;
create policy config_cobranca_sistema_owner_insert on public.config_cobranca_sistema for insert to authenticated with check (exists (select 1 from public.organization_members m where m.organization_id=config_cobranca_sistema.organization_id and m.user_id=auth.uid() and m.role='owner'));
drop policy if exists config_cobranca_sistema_owner_update on public.config_cobranca_sistema;
create policy config_cobranca_sistema_owner_update on public.config_cobranca_sistema for update to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=config_cobranca_sistema.organization_id and m.user_id=auth.uid() and m.role='owner')) with check (exists (select 1 from public.organization_members m where m.organization_id=config_cobranca_sistema.organization_id and m.user_id=auth.uid() and m.role='owner'));
grant select,insert,update on public.config_cobranca_sistema to authenticated;
