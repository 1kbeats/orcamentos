alter table public.producoes
  add column if not exists produtor_responsavel text;

create index if not exists producoes_org_data_agenda_idx
  on public.producoes (organization_id, data_evento, status);

comment on column public.producoes.produtor_responsavel is
  'Produtor interno responsável pelo evento e pela comunicação operacional.';
