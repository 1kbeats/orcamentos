-- Zera os orçamentos da 1K Beats para a entrega ao Walter.
-- A empresa é localizada pelo último orçamento de teste conhecido (0002).

do $cleanup$
declare
  v_organization_id uuid;
begin
  select organization_id
    into v_organization_id
  from public.orcamentos
  where numero = 2
  order by created_at desc
  limit 1;

  if v_organization_id is null then
    return;
  end if;

  delete from public.ordens_servico
  where organization_id = v_organization_id
    and orcamento_id in (
      select id from public.orcamentos where organization_id = v_organization_id
    );

  delete from public.producoes
  where organization_id = v_organization_id
    and orcamento_id in (
      select id from public.orcamentos where organization_id = v_organization_id
    );

  delete from public.orcamentos
  where organization_id = v_organization_id;

  insert into public.organization_quote_counters (organization_id, next_number)
  values (v_organization_id, 1)
  on conflict (organization_id) do update
  set next_number = 1;
end;
$cleanup$;
