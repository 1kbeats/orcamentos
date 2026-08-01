-- Corrige a valida\u00e7\u00e3o por empresa para cada tipo de lan\u00e7amento.
-- Uma fun\u00e7\u00e3o de trigger compartilhada n\u00e3o pode acessar campos que n\u00e3o existem em todas as tabelas.

create or replace function public.validate_operation_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'equipe_diarias' then
    if not exists (
      select 1 from public.equipe
      where id = new.equipe_id and organization_id = new.organization_id
    ) then
      raise exception 'O profissional precisa pertencer \u00e0 mesma empresa.';
    end if;
  elsif tg_table_name = 'fornecedor_eventos' then
    if not exists (
      select 1 from public.fornecedores
      where id = new.fornecedor_id and organization_id = new.organization_id
    ) then
      raise exception 'O fornecedor precisa pertencer \u00e0 mesma empresa.';
    end if;
  end if;

  if new.orcamento_id is not null and not exists (
    select 1 from public.orcamentos
    where id = new.orcamento_id and organization_id = new.organization_id
  ) then
    raise exception 'O evento precisa pertencer \u00e0 mesma empresa.';
  end if;
  return new;
end;
$$;
