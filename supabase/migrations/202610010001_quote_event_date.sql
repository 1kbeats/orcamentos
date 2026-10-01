alter table public.orcamentos
  add column if not exists data_evento date;

create index if not exists orcamentos_org_event_date_idx
  on public.orcamentos(organization_id, data_evento desc nulls last);

create or replace function public.get_public_quote(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', quote.numero,
    'cliente_nome', quote.cliente_nome,
    'cnpj_cli', quote.cnpj_cli,
    'referencia', quote.referencia,
    'valido_ate', quote.valido_ate,
    'data_evento', quote.data_evento,
    'desconto_tipo', quote.desconto_tipo,
    'desconto_valor', quote.desconto_valor,
    'itens', quote.itens,
    'observacoes', quote.observacoes,
    'empresa', quote.empresa,
    'cnpj_emp', quote.cnpj_emp,
    'tel_emp', quote.tel_emp,
    'email_emp', quote.email_emp,
    'solicitante', quote.solicitante,
    'total', quote.total,
    'status', quote.status,
    'created_at', quote.created_at
  )
  from public.orcamentos quote
  where quote.public_token = p_token
    and quote.public_enabled = true
  limit 1;
$$;

revoke all on function public.get_public_quote(uuid) from public;
grant execute on function public.get_public_quote(uuid) to anon, authenticated;
