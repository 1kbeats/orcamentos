update public.orcamentos as quote
set data_evento = production.data_evento
from public.producoes as production
where quote.id = production.orcamento_id
  and quote.organization_id = production.organization_id
  and quote.data_evento is null
  and production.data_evento is not null;
