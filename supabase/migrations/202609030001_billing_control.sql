-- Controle simples de cobrancas da plataforma Pryntix.
create table if not exists public.cobrancas_sistema (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null default 'mensalidade' check (tipo in ('implantacao','mensalidade')),
  competencia text not null,
  vencimento date not null,
  valor numeric(14,2) not null check (valor > 0),
  status text not null default 'pendente' check (status in ('pendente','pago')),
  pago_em date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tipo, competencia)
);

create index if not exists cobrancas_sistema_org_vencimento_idx
  on public.cobrancas_sistema(organization_id, vencimento desc);

drop trigger if exists cobrancas_sistema_touch_updated_at on public.cobrancas_sistema;
create trigger cobrancas_sistema_touch_updated_at before update on public.cobrancas_sistema
for each row execute function public.touch_updated_at();

alter table public.cobrancas_sistema enable row level security;

drop policy if exists cobrancas_sistema_select_member on public.cobrancas_sistema;
create policy cobrancas_sistema_select_member on public.cobrancas_sistema
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists cobrancas_sistema_insert_owner on public.cobrancas_sistema;
create policy cobrancas_sistema_insert_owner on public.cobrancas_sistema
for insert to authenticated with check (
  exists (select 1 from public.organization_members m
          where m.organization_id = cobrancas_sistema.organization_id
            and m.user_id = auth.uid() and m.role = 'owner')
);

drop policy if exists cobrancas_sistema_update_owner on public.cobrancas_sistema;
create policy cobrancas_sistema_update_owner on public.cobrancas_sistema
for update to authenticated using (
  exists (select 1 from public.organization_members m
          where m.organization_id = cobrancas_sistema.organization_id
            and m.user_id = auth.uid() and m.role = 'owner')
) with check (
  exists (select 1 from public.organization_members m
          where m.organization_id = cobrancas_sistema.organization_id
            and m.user_id = auth.uid() and m.role = 'owner')
);

drop policy if exists cobrancas_sistema_delete_owner on public.cobrancas_sistema;
create policy cobrancas_sistema_delete_owner on public.cobrancas_sistema
for delete to authenticated using (
  exists (select 1 from public.organization_members m
          where m.organization_id = cobrancas_sistema.organization_id
            and m.user_id = auth.uid() and m.role = 'owner')
);

grant select, insert, update, delete on public.cobrancas_sistema to authenticated;

-- Primeira mensalidade contratada: valor de R$ 300,00, vencimento no dia 10.
insert into public.cobrancas_sistema (organization_id, tipo, competencia, vencimento, valor)
select c.organization_id, 'mensalidade', '09/2026', date '2026-09-10', 300.00
from public.config c
where regexp_replace(coalesce(c.cnpj,''), '\D', '', 'g') = '62496834000197'
  and c.organization_id is not null
on conflict (organization_id, tipo, competencia) do nothing;
