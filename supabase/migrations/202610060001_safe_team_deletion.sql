-- Preserve financial history when removing team members.
-- Professionals without linked daily-rate records can still be deleted.
alter table public.equipe_diarias
  drop constraint if exists equipe_diarias_equipe_id_fkey;

alter table public.equipe_diarias
  add constraint equipe_diarias_equipe_id_fkey
  foreign key (equipe_id)
  references public.equipe(id)
  on delete restrict;
