-- Limpeza final dos dados de teste antes da entrega para o Walter.
-- Preserva cadastros, catálogo, usuários e demais dados permanentes.

do $cleanup$
declare
  v_quote_id uuid := '1c0d0077-ca39-4f36-9ee4-7ab5deb59ad2'::uuid;
  v_organization_id uuid;
begin
  select organization_id
    into v_organization_id
  from public.orcamentos
  where id = v_quote_id;

  if v_organization_id is null then
    return;
  end if;

  delete from public.ordens_servico
  where organization_id = v_organization_id
    and orcamento_id = v_quote_id;

  delete from public.producoes
  where organization_id = v_organization_id
    and orcamento_id = v_quote_id;

  delete from public.orcamentos
  where organization_id = v_organization_id
    and id = v_quote_id;

  insert into public.organization_quote_counters (organization_id, next_number)
  values (v_organization_id, 1)
  on conflict (organization_id) do update
  set next_number = 1;
end;
$cleanup$;
