-- Estoque simples: cadastro de equipamentos e movimentações auditáveis.
create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 180),
  categoria text not null check (categoria in ('audio','iluminacao','video','estrutura','cabos','energia','acessorios','outros')),
  codigo text,
  marca_modelo text,
  numero_serie text,
  quantidade_total integer not null default 1 check (quantidade_total >= 0),
  quantidade_disponivel integer not null default 1 check (quantidade_disponivel >= 0 and quantidade_disponivel <= quantidade_total),
  localizacao text,
  valor_aquisicao numeric(12,2) not null default 0 check (valor_aquisicao >= 0),
  observacoes text,
  ativo boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists estoque_itens_org_codigo_unique
  on public.estoque_itens(organization_id, lower(codigo)) where codigo is not null and trim(codigo) <> '';
create index if not exists estoque_itens_org_nome_idx on public.estoque_itens(organization_id, ativo desc, nome);

create table if not exists public.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.estoque_itens(id) on delete restrict,
  producao_id uuid references public.producoes(id) on delete set null,
  tipo text not null check (tipo in ('cadastro','saida_evento','devolucao_evento','envio_manutencao','retorno_manutencao','ajuste_entrada','ajuste_saida')),
  quantidade integer not null check (quantidade > 0),
  efeito_total integer not null default 0,
  efeito_disponivel integer not null default 0,
  saldo_total_depois integer not null check (saldo_total_depois >= 0),
  saldo_disponivel_depois integer not null check (saldo_disponivel_depois >= 0 and saldo_disponivel_depois <= saldo_total_depois),
  responsavel text,
  data_movimentacao timestamptz not null default now(),
  observacoes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists estoque_movimentacoes_org_data_idx on public.estoque_movimentacoes(organization_id, data_movimentacao desc);
create index if not exists estoque_movimentacoes_item_data_idx on public.estoque_movimentacoes(item_id, data_movimentacao desc);

drop trigger if exists estoque_itens_touch_updated_at on public.estoque_itens;
create trigger estoque_itens_touch_updated_at before update on public.estoque_itens
for each row execute function public.touch_updated_at();

create or replace function public.guard_inventory_quantity_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.quantidade_total, new.quantidade_disponivel) is distinct from (old.quantidade_total, old.quantidade_disponivel)
     and coalesce(current_setting('app.inventory_write', true), '') <> 'allowed' then
    raise exception 'Use uma movimentação para alterar a quantidade do estoque.';
  end if;

  if old.ativo and not new.ativo and new.quantidade_disponivel <> new.quantidade_total then
    raise exception 'Devolva todas as unidades antes de arquivar o equipamento.';
  end if;
  return new;
end; $$;

drop trigger if exists estoque_itens_guard_quantity on public.estoque_itens;
create trigger estoque_itens_guard_quantity before update on public.estoque_itens
for each row execute function public.guard_inventory_quantity_update();

create or replace function public.inventory_initial_movement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.quantidade_total > 0 then
    insert into public.estoque_movimentacoes(
      organization_id,item_id,tipo,quantidade,efeito_total,efeito_disponivel,
      saldo_total_depois,saldo_disponivel_depois,responsavel,created_by
    ) values (
      new.organization_id,new.id,'cadastro',new.quantidade_total,new.quantidade_total,new.quantidade_total,
      new.quantidade_total,new.quantidade_disponivel,'Cadastro inicial',coalesce(new.created_by,auth.uid())
    );
  end if;
  return new;
end; $$;

revoke all on function public.inventory_initial_movement() from public, anon, authenticated;
drop trigger if exists estoque_itens_initial_movement on public.estoque_itens;
create trigger estoque_itens_initial_movement after insert on public.estoque_itens
for each row execute function public.inventory_initial_movement();

create or replace function public.registrar_movimentacao_estoque(
  p_item_id uuid,
  p_tipo text,
  p_quantidade integer,
  p_producao_id uuid default null,
  p_responsavel text default null,
  p_data_movimentacao timestamptz default now(),
  p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.estoque_itens%rowtype;
  v_total_delta integer := 0;
  v_available_delta integer := 0;
  v_movement_id uuid;
begin
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'A quantidade precisa ser maior que zero.'; end if;
  if p_tipo not in ('saida_evento','devolucao_evento','envio_manutencao','retorno_manutencao','ajuste_entrada','ajuste_saida') then raise exception 'Tipo de movimentação inválido.'; end if;

  select * into v_item from public.estoque_itens where id = p_item_id for update;
  if not found then raise exception 'Equipamento não encontrado.'; end if;
  if not public.is_org_admin(v_item.organization_id) then raise exception 'Sem permissão para movimentar este estoque.'; end if;
  if not v_item.ativo and p_tipo not in ('ajuste_entrada','ajuste_saida') then raise exception 'Reative o equipamento antes de movimentá-lo.'; end if;
  if p_producao_id is not null and not exists (
    select 1 from public.producoes where id = p_producao_id and organization_id = v_item.organization_id
  ) then raise exception 'A produção precisa pertencer à mesma empresa.'; end if;

  case p_tipo
    when 'saida_evento' then v_available_delta := -p_quantidade;
    when 'devolucao_evento' then v_available_delta := p_quantidade;
    when 'envio_manutencao' then v_available_delta := -p_quantidade;
    when 'retorno_manutencao' then v_available_delta := p_quantidade;
    when 'ajuste_entrada' then v_total_delta := p_quantidade; v_available_delta := p_quantidade;
    when 'ajuste_saida' then v_total_delta := -p_quantidade; v_available_delta := -p_quantidade;
  end case;

  if v_item.quantidade_disponivel + v_available_delta < 0 then raise exception 'Quantidade indisponível para esta saída.'; end if;
  if v_item.quantidade_total + v_total_delta < 0 then raise exception 'O ajuste ultrapassa a quantidade total.'; end if;
  if v_item.quantidade_disponivel + v_available_delta > v_item.quantidade_total + v_total_delta then raise exception 'A devolução ultrapassa a quantidade total.'; end if;

  perform set_config('app.inventory_write','allowed',true);
  update public.estoque_itens set
    quantidade_total = quantidade_total + v_total_delta,
    quantidade_disponivel = quantidade_disponivel + v_available_delta
  where id = v_item.id;

  insert into public.estoque_movimentacoes(
    organization_id,item_id,producao_id,tipo,quantidade,efeito_total,efeito_disponivel,
    saldo_total_depois,saldo_disponivel_depois,responsavel,data_movimentacao,observacoes,created_by
  ) values (
    v_item.organization_id,v_item.id,p_producao_id,p_tipo,p_quantidade,v_total_delta,v_available_delta,
    v_item.quantidade_total + v_total_delta,v_item.quantidade_disponivel + v_available_delta,
    nullif(trim(p_responsavel),''),coalesce(p_data_movimentacao,now()),nullif(trim(p_observacoes),''),auth.uid()
  ) returning id into v_movement_id;
  return v_movement_id;
end; $$;

revoke all on function public.registrar_movimentacao_estoque(uuid,text,integer,uuid,text,timestamptz,text) from public, anon;
grant execute on function public.registrar_movimentacao_estoque(uuid,text,integer,uuid,text,timestamptz,text) to authenticated;

alter table public.estoque_itens enable row level security;
alter table public.estoque_movimentacoes enable row level security;
revoke all on public.estoque_itens, public.estoque_movimentacoes from anon;
grant select, insert, update, delete on public.estoque_itens to authenticated;
grant select on public.estoque_movimentacoes to authenticated;
revoke insert, update, delete on public.estoque_movimentacoes from authenticated;

drop policy if exists estoque_itens_select_operation on public.estoque_itens;
create policy estoque_itens_select_operation on public.estoque_itens for select to authenticated using (public.can_view_operations(organization_id));
drop policy if exists estoque_itens_write_admin on public.estoque_itens;
create policy estoque_itens_write_admin on public.estoque_itens for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists estoque_movimentacoes_select_operation on public.estoque_movimentacoes;
create policy estoque_movimentacoes_select_operation on public.estoque_movimentacoes for select to authenticated using (public.can_view_operations(organization_id));

analyze public.estoque_itens;
analyze public.estoque_movimentacoes;
