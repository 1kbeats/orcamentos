-- Exclusão administrativa segura de orçamentos e vínculos operacionais.

create or replace function public.excluir_orcamentos_com_vinculos(
  p_ids uuid[],
  p_confirmacao text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_organization_id uuid;
  v_organizations integer;
  v_quotes integer;
  v_productions integer;
  v_orders integer;
begin
  if p_confirmacao is distinct from 'EXCLUIR' then
    raise exception 'Confirmação inválida para exclusão definitiva.';
  end if;

  select array_agg(distinct requested_id)
    into v_ids
  from unnest(coalesce(p_ids, array[]::uuid[])) requested_id
  where requested_id is not null;

  if coalesce(cardinality(v_ids), 0) = 0 then
    raise exception 'Nenhum orçamento foi informado.';
  end if;

  select count(*), count(distinct quote.organization_id), (array_agg(distinct quote.organization_id))[1]
    into v_quotes, v_organizations, v_organization_id
  from public.orcamentos quote
  where quote.id = any(v_ids)
    and public.is_org_admin(quote.organization_id);

  if v_quotes <> cardinality(v_ids) or v_organizations <> 1 then
    raise exception 'Um ou mais orçamentos não existem ou não pertencem à sua empresa.';
  end if;

  select count(*) into v_orders
  from public.ordens_servico service_order
  where service_order.organization_id = v_organization_id
    and service_order.orcamento_id = any(v_ids);

  select count(*) into v_productions
  from public.producoes production
  where production.organization_id = v_organization_id
    and production.orcamento_id = any(v_ids);

  delete from public.ordens_servico service_order
  where service_order.organization_id = v_organization_id
    and service_order.orcamento_id = any(v_ids);

  delete from public.producoes production
  where production.organization_id = v_organization_id
    and production.orcamento_id = any(v_ids);

  delete from public.orcamentos quote
  where quote.organization_id = v_organization_id
    and quote.id = any(v_ids);

  return jsonb_build_object(
    'orcamentos', v_quotes,
    'producoes', v_productions,
    'ordens_servico', v_orders
  );
end;
$$;

revoke all on function public.excluir_orcamentos_com_vinculos(uuid[], text) from public, anon;
grant execute on function public.excluir_orcamentos_com_vinculos(uuid[], text) to authenticated;