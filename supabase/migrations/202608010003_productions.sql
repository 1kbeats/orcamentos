-- Centro operacional: cada produ\u00e7\u00e3o representa um evento aprovado da 1000 Beats.

create table if not exists public.producoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id) on delete restrict,
  nome text not null check (char_length(trim(nome)) between 2 and 180),
  data_evento date,
  hora_montagem time,
  hora_evento time,
  endereco text,
  local_evento text,
  veiculo text,
  status text not null default 'planejamento' check (status in ('planejamento', 'confirmado', 'realizado', 'cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, orcamento_id)
);

create index if not exists producoes_org_data_idx on public.producoes(organization_id, data_evento asc nulls last);
create index if not exists producoes_orcamento_idx on public.producoes(orcamento_id);

alter table public.producoes enable row level security;
revoke all on public.producoes from anon;
grant select, insert, update, delete on public.producoes to authenticated;
drop policy if exists producoes_admin_all on public.producoes;
create policy producoes_admin_all on public.producoes
for all to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create or replace function public.validate_producao_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.orcamentos
    where id = new.orcamento_id and organization_id = new.organization_id
  ) then
    raise exception 'O orçamento precisa pertencer à mesma empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists producoes_validate_organization on public.producoes;
create trigger producoes_validate_organization before insert or update on public.producoes
for each row execute function public.validate_producao_organization();
drop trigger if exists producoes_touch_updated_at on public.producoes;
create trigger producoes_touch_updated_at before update on public.producoes
for each row execute function public.touch_updated_at();
