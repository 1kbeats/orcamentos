grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

-- O papel anônimo só pode executar a visualização pública restrita.
grant execute on function public.get_public_quote(uuid) to anon, authenticated;
