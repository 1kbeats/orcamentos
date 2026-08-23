-- 1K Beats v6.9.4: permissoes granulares por modulo.
alter table public.organization_members
  add column if not exists module_permissions jsonb not null default '{}'::jsonb;

alter table public.organization_members
  drop constraint if exists organization_members_module_permissions_object;
alter table public.organization_members
  add constraint organization_members_module_permissions_object
  check (jsonb_typeof(module_permissions) = 'object');

create or replace function public.member_module_access(p_organization_id uuid, p_module text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when membership.role = 'owner' then 'edit'
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

create or replace function public.can_view_module(p_organization_id uuid, p_module text)
returns boolean language sql stable security definer set search_path = '' as $function$
  select coalesce(public.member_module_access(p_organization_id, p_module) in ('view','edit'), false);
$function$;

create or replace function public.can_edit_module(p_organization_id uuid, p_module text)
returns boolean language sql stable security definer set search_path = '' as $function$
  select coalesce(public.member_module_access(p_organization_id, p_module) = 'edit', false);
$function$;

revoke all on function public.member_module_access(uuid,text) from public;
revoke all on function public.can_view_module(uuid,text) from public;
revoke all on function public.can_edit_module(uuid,text) from public;
grant execute on function public.member_module_access(uuid,text) to authenticated;
grant execute on function public.can_view_module(uuid,text) to authenticated;
grant execute on function public.can_edit_module(uuid,text) to authenticated;

-- Substitui as politicas das tabelas controladas para impedir acesso pela API direta.
do $policies$
declare
  item record;
  policy_row record;
begin
  for item in select * from (values
    ('clientes','clientes_catalogo','clientes_catalogo'),
    ('catalogo','clientes_catalogo','clientes_catalogo'),
    ('orcamentos','orcamentos','orcamentos'),
    ('producoes','agenda','agenda'),
    ('ordens_servico','agenda','agenda'),
    ('gastos','despesas','financeiro'),
    ('equipe','equipe','financeiro'),
    ('equipe_diarias','equipe','financeiro'),
    ('fornecedores','fornecedores','financeiro'),
    ('fornecedor_eventos','fornecedores','financeiro'),
    ('estoque_itens','estoque','estoque'),
    ('estoque_movimentacoes','estoque','estoque')
  ) as modules(table_name, primary_module, read_alternative)
  loop
    if to_regclass('public.' || item.table_name) is null then continue; end if;
    for policy_row in select policyname from pg_policies where schemaname='public' and tablename=item.table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, item.table_name);
    end loop;
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_view_module(organization_id,%L) or public.can_view_module(organization_id,%L))',
      item.table_name || '_module_select', item.table_name, item.primary_module, item.read_alternative
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_edit_module(organization_id,%L))',
      item.table_name || '_module_insert', item.table_name, item.primary_module
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_edit_module(organization_id,%L)) with check (public.can_edit_module(organization_id,%L))',
      item.table_name || '_module_update', item.table_name, item.primary_module, item.primary_module
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_edit_module(organization_id,%L))',
      item.table_name || '_module_delete', item.table_name, item.primary_module
    );
  end loop;
end;
$policies$;

-- A movimentacao de estoque passa a respeitar a permissao granular do modulo.
-- A regra anterior aceitava apenas o papel administrativo, mesmo quando o
-- proprietario liberasse explicitamente a edicao de estoque para outro perfil.
create or replace function public.registrar_movimentacao_estoque(
  p_item_id uuid,
  p_tipo text,
  p_quantidade integer,
  p_producao_id uuid default null,
  p_responsavel text default null,
  p_data_movimentacao timestamptz default now(),
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.estoque_itens%rowtype;
  v_total_delta integer := 0;
  v_available_delta integer := 0;
  v_movement_id uuid;
begin
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'A quantidade precisa ser maior que zero.'; end if;
  if p_tipo not in ('saida_evento','devolucao_evento','envio_manutencao','retorno_manutencao','ajuste_entrada','ajuste_saida') then raise exception 'Tipo de movimentacao invalido.'; end if;
  select * into v_item from public.estoque_itens where id = p_item_id for update;
  if not found then raise exception 'Equipamento nao encontrado.'; end if;
  if not public.can_edit_module(v_item.organization_id, 'estoque') then raise exception 'Sem permissao para movimentar este estoque.'; end if;
  if not v_item.ativo and p_tipo not in ('ajuste_entrada','ajuste_saida') then raise exception 'Reative o equipamento antes de movimenta-lo.'; end if;
  if p_producao_id is not null and not exists (
    select 1 from public.producoes where id = p_producao_id and organization_id = v_item.organization_id
  ) then raise exception 'A producao precisa pertencer a mesma empresa.'; end if;
  case p_tipo
    when 'saida_evento' then v_available_delta := -p_quantidade;
    when 'devolucao_evento' then v_available_delta := p_quantidade;
    when 'envio_manutencao' then v_available_delta := -p_quantidade;
    when 'retorno_manutencao' then v_available_delta := p_quantidade;
    when 'ajuste_entrada' then v_total_delta := p_quantidade; v_available_delta := p_quantidade;
    when 'ajuste_saida' then v_total_delta := -p_quantidade; v_available_delta := -p_quantidade;
  end case;
  if v_item.quantidade_disponivel + v_available_delta < 0 then raise exception 'Quantidade indisponivel para esta saida.'; end if;
  if v_item.quantidade_total + v_total_delta < 0 then raise exception 'O ajuste ultrapassa a quantidade total.'; end if;
  if v_item.quantidade_disponivel + v_available_delta > v_item.quantidade_total + v_total_delta then raise exception 'A devolucao ultrapassa a quantidade total.'; end if;
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
end;
$function$;

revoke all on function public.registrar_movimentacao_estoque(uuid,text,integer,uuid,text,timestamptz,text) from public, anon;
grant execute on function public.registrar_movimentacao_estoque(uuid,text,integer,uuid,text,timestamptz,text) to authenticated;
