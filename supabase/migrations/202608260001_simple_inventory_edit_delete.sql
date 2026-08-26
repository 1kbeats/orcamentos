-- Permite excluir somente cadastros de estoque que nunca tiveram uso operacional.
-- O movimento automatico de cadastro inicial e removido junto com o item.
create or replace function public.excluir_item_estoque_sem_uso(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.estoque_itens%rowtype;
begin
  select * into v_item
  from public.estoque_itens
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Equipamento nao encontrado.';
  end if;

  if not public.can_edit_module(v_item.organization_id, 'estoque') then
    raise exception 'Sem permissao para excluir este equipamento.';
  end if;

  if exists (
    select 1
    from public.estoque_movimentacoes
    where item_id = v_item.id
      and tipo <> 'cadastro'
  ) then
    raise exception 'Este equipamento ja possui movimentacoes. Arquive o cadastro para preservar o historico.';
  end if;

  delete from public.estoque_movimentacoes
  where item_id = v_item.id
    and tipo = 'cadastro';

  delete from public.estoque_itens
  where id = v_item.id;
end;
$function$;

revoke all on function public.excluir_item_estoque_sem_uso(uuid) from public, anon;
grant execute on function public.excluir_item_estoque_sem_uso(uuid) to authenticated;
