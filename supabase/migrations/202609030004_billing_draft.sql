alter table public.cobrancas_sistema
  add column if not exists telefone_envio text,
  add column if not exists mensagem_envio text;

comment on column public.cobrancas_sistema.telefone_envio is
  'Telefone informado pelo administrador para o envio da cobrança.';

comment on column public.cobrancas_sistema.mensagem_envio is
  'Mensagem personalizada salva pelo administrador para envio posterior.';
