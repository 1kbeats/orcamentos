# Publicação da versão segura

Este roteiro deve ser executado somente depois da revisão da branch e dos testes
locais. O projeto correto é `1kbeats-orcamentos`
(`hcjbfdspmqlyzkgypacb`). O projeto `printer-co-orcamentos` não faz parte desta
implantação.

## Ordem de publicação

1. Confirmar o backup privado criado antes das mudanças.
2. Executar `supabase db push --linked --dry-run`.
3. Aplicar as migrações com `supabase db push --linked`.
4. Definir `ALLOWED_ORIGINS=https://1kbeats.github.io`.
5. Publicar a função `admin-user` mantendo `verify_jwt = true`.
6. Publicar o frontend da branch revisada no GitHub Pages.
7. Entrar imediatamente com o usuário proprietário da 1000 Beats para executar
   a associação inicial dos dados legados.
8. Validar clientes, catálogo, configurações, os 21 orçamentos existentes e o
   novo link público por token.
9. Desativar as funções antigas `criar-usuario` e `admin-usuarios`. Elas não
   podem permanecer acessíveis porque não usam o novo modelo de permissões.
10. Revogar a antiga chave `service_role` que apareceu no frontend das versões
    anteriores, depois de confirmar que nenhum serviço legítimo ainda a usa.

## Critérios de reversão

- A branch `main` anterior e o commit de origem devem permanecer preservados.
- Os arquivos privados de backup não devem ser adicionados ao Git.
- Se o primeiro login não associar os dados à organização 1000 Beats, interrompa
  a publicação e não crie outra organização.
- Não use `db reset --linked`: esse comando apagaria o banco remoto.
