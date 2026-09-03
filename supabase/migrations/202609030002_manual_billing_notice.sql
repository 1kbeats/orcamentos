-- O proprietario decide quando o aviso de cobranca aparece aos demais usuarios.
alter table public.cobrancas_sistema
  add column if not exists aviso_visivel boolean not null default false;

update public.cobrancas_sistema
set aviso_visivel = false
where status = 'pago';
