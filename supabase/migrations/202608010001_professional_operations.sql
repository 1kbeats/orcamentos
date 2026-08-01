-- 1K Beats: opera\u00e7\u00e3o profissional para som, luz e v\u00eddeo.
-- Gastos, equipe/freelancers e fornecedores vinculados aos eventos (or\u00e7amentos).

create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 150),
  funcao text,
  telefone text,
  email text,
  cpf text,
  rg text,
  filiacao text,
  valor_diaria numeric(14,2) not null default 0 check (valor_diaria >= 0),
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipe_diarias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipe_id uuid not null references public.equipe(id) on delete cascade,
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  data date not null default current_date,
  funcao_evento text,
  valor_diaria numeric(14,2) not null check (valor_diaria >= 0),
  horario_inicio time,
  horario_fim time,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 150),
  tipo text not null default 'prestador' check (tipo in ('carregador', 'transporte', 'locacao', 'prestador', 'outro')),
  contato text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fornecedor_eventos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  data date not null default current_date,
  descricao_servico text,
  horario_chegada time,
  valor numeric(14,2) not null check (valor >= 0),
  status_pagamento text not null default 'pendente' check (status_pagamento in ('pendente', 'pago')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  data date not null default current_date,
  categoria text not null check (categoria in ('combustivel', 'alimentacao', 'manutencao', 'equipamento', 'logistica', 'nota_fiscal', 'outro')),
  descricao text not null check (char_length(trim(descricao)) between 2 and 300),
  fornecedor text,
  nota_fiscal text,
  valor numeric(14,2) not null check (valor >= 0),
  status_pagamento text not null default 'pago' check (status_pagamento in ('pendente', 'pago')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipe_org_nome_idx on public.equipe(organization_id, nome);
create index if not exists equipe_diarias_org_data_idx on public.equipe_diarias(organization_id, data desc);
create index if not exists equipe_diarias_orcamento_idx on public.equipe_diarias(orcamento_id);
create index if not exists fornecedores_org_nome_idx on public.fornecedores(organization_id, nome);
create index if not exists fornecedor_eventos_org_data_idx on public.fornecedor_eventos(organization_id, data desc);
create index if not exists fornecedor_eventos_orcamento_idx on public.fornecedor_eventos(orcamento_id);
create index if not exists gastos_org_data_idx on public.gastos(organization_id, data desc);
create index if not exists gastos_orcamento_idx on public.gastos(orcamento_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['equipe', 'equipe_diarias', 'fornecedores', 'fornecedor_eventos', 'gastos']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id))',
      table_name || '_admin_all', table_name
    );
  end loop;
end $$;

drop trigger if exists equipe_touch_updated_at on public.equipe;
create trigger equipe_touch_updated_at before update on public.equipe
for each row execute function public.touch_updated_at();
drop trigger if exists equipe_diarias_touch_updated_at on public.equipe_diarias;
create trigger equipe_diarias_touch_updated_at before update on public.equipe_diarias
for each row execute function public.touch_updated_at();
drop trigger if exists fornecedores_touch_updated_at on public.fornecedores;
create trigger fornecedores_touch_updated_at before update on public.fornecedores
for each row execute function public.touch_updated_at();
drop trigger if exists fornecedor_eventos_touch_updated_at on public.fornecedor_eventos;
create trigger fornecedor_eventos_touch_updated_at before update on public.fornecedor_eventos
for each row execute function public.touch_updated_at();
drop trigger if exists gastos_touch_updated_at on public.gastos;
create trigger gastos_touch_updated_at before update on public.gastos
for each row execute function public.touch_updated_at();

create or replace function public.validate_operation_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'equipe_diarias' and not exists (
    select 1 from public.equipe where id = new.equipe_id and organization_id = new.organization_id
  ) then
    raise exception 'O profissional precisa pertencer à mesma empresa.';
  end if;
  if tg_table_name = 'fornecedor_eventos' and not exists (
    select 1 from public.fornecedores where id = new.fornecedor_id and organization_id = new.organization_id
  ) then
    raise exception 'O fornecedor precisa pertencer à mesma empresa.';
  end if;
  if new.orcamento_id is not null and not exists (
    select 1 from public.orcamentos where id = new.orcamento_id and organization_id = new.organization_id
  ) then
    raise exception 'O evento precisa pertencer à mesma empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists equipe_diarias_validate_organization on public.equipe_diarias;
create trigger equipe_diarias_validate_organization before insert or update on public.equipe_diarias
for each row execute function public.validate_operation_organization();
drop trigger if exists fornecedor_eventos_validate_organization on public.fornecedor_eventos;
create trigger fornecedor_eventos_validate_organization before insert or update on public.fornecedor_eventos
for each row execute function public.validate_operation_organization();
drop trigger if exists gastos_validate_organization on public.gastos;
create trigger gastos_validate_organization before insert or update on public.gastos
for each row execute function public.validate_operation_organization();