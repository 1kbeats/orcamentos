-- Remove somente a conta de teste Luccas, preservando um registro recuperavel.
do $migration$
declare
  v_user_id uuid;
  v_organization_id uuid;
  v_role text;
  v_email text := 'acslima77@gmail.com';
  v_batch_id uuid := gen_random_uuid();
begin
  select users.id, members.organization_id, members.role
    into v_user_id, v_organization_id, v_role
  from auth.users users
  join public.organization_members members on members.user_id = users.id
  where lower(users.email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise notice 'Conta de teste % nao encontrada; nenhuma alteracao aplicada.', v_email;
    return;
  end if;

  if v_role = 'owner' then
    raise exception 'Exclusao cancelada: a conta informada e proprietaria da empresa.';
  end if;

  insert into private.cleanup_archive (
    batch_id,
    organization_id,
    table_name,
    row_data
  )
  values (
    v_batch_id,
    v_organization_id,
    'auth.users',
    jsonb_build_object(
      'id', v_user_id,
      'email', v_email,
      'role', v_role,
      'reason', 'conta de teste Luccas removida com autorizacao do cliente'
    )
  );

  delete from auth.users where id = v_user_id;
end;
$migration$;

analyze public.organization_members;
