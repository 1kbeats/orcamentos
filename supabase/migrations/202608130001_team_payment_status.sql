alter table public.equipe_diarias
  add column if not exists status_pagamento text not null default 'pendente';

alter table public.equipe_diarias
  drop constraint if exists equipe_diarias_status_pagamento_check;

alter table public.equipe_diarias
  add constraint equipe_diarias_status_pagamento_check
  check (status_pagamento in ('pendente', 'pago'));

comment on column public.equipe_diarias.status_pagamento is
  'Situação do pagamento da diária do profissional no evento.';
