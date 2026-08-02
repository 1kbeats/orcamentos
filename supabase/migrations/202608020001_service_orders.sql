-- Ordens de serviço operacionais da 1K Beats.
create table if not exists public.organization_service_order_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_number bigint not null default 1 check (next_number > 0)
);
create table if not exists public.ordens_servico (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  numero bigint not null, producao_id uuid not null references public.producoes(id) on delete restrict,
  orcamento_id uuid not null references public.orcamentos(id) on delete restrict,
  responsavel_id uuid references public.equipe(id) on delete set null,
  titulo text not null check (char_length(trim(titulo)) between 2 and 180), cliente_nome text,
  contato_local text, telefone_contato text, responsavel_nome text, responsavel_telefone text,
  data_evento date, hora_montagem time, hora_evento time, local_evento text, endereco text, veiculo text,
  itens jsonb not null default '[]'::jsonb, equipe jsonb not null default '[]'::jsonb,
  orientacoes text, traje text, observacoes text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'confirmada')),
  enviada_em timestamptz, confirmada_em timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, numero), unique (organization_id, producao_id)
);
create index if not exists ordens_servico_org_data_idx on public.ordens_servico(organization_id, data_evento desc nulls last);
create index if not exists ordens_servico_producao_idx on public.ordens_servico(producao_id);
create or replace function public.assign_service_order_number() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_allocated bigint;
begin
  insert into public.organization_service_order_counters (organization_id, next_number) values (new.organization_id, 2)
  on conflict (organization_id) do update set next_number = public.organization_service_order_counters.next_number + 1
  returning next_number - 1 into v_allocated;
  new.numero := v_allocated; return new;
end; $$;
revoke all on function public.assign_service_order_number() from public, anon, authenticated;
drop trigger if exists ordens_servico_assign_number on public.ordens_servico;
create trigger ordens_servico_assign_number before insert on public.ordens_servico for each row execute function public.assign_service_order_number();
create or replace function public.validate_service_order_organization() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.producoes where id = new.producao_id and organization_id = new.organization_id and orcamento_id = new.orcamento_id) then raise exception 'A produção e o orçamento precisam pertencer à mesma empresa.'; end if;
  if new.responsavel_id is not null and not exists (select 1 from public.equipe where id = new.responsavel_id and organization_id = new.organization_id) then raise exception 'O responsável precisa pertencer à mesma empresa.'; end if;
  return new;
end; $$;
drop trigger if exists ordens_servico_validate_organization on public.ordens_servico;
create trigger ordens_servico_validate_organization before insert or update on public.ordens_servico for each row execute function public.validate_service_order_organization();
drop trigger if exists ordens_servico_touch_updated_at on public.ordens_servico;
create trigger ordens_servico_touch_updated_at before update on public.ordens_servico for each row execute function public.touch_updated_at();
alter table public.ordens_servico enable row level security;
revoke all on public.ordens_servico from anon;
grant select, insert, update, delete on public.ordens_servico to authenticated;
drop policy if exists ordens_servico_select_operation on public.ordens_servico;
create policy ordens_servico_select_operation on public.ordens_servico for select to authenticated using (public.can_view_operations(organization_id));
drop policy if exists ordens_servico_write_admin on public.ordens_servico;
create policy ordens_servico_write_admin on public.ordens_servico for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
revoke all on public.organization_service_order_counters from public, anon, authenticated;
alter table public.organization_service_order_counters enable row level security;
analyze public.ordens_servico;