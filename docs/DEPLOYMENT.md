# Implantação segura

Não publique o frontend antes de concluir as etapas abaixo.

## 1. Conter a chave comprometida

1. Faça backup do banco.
2. No Supabase, crie uma nova **Secret key** para uso somente no backend.
3. Confirme que nenhuma aplicação legítima depende da antiga `service_role`.
4. Desative a chave legada comprometida depois de validar a nova função.
5. Crie ou selecione uma **Publishable key** para o frontend e substitua o valor
   público em `js/config.js`.

Nunca copie uma Secret key, `service_role`, senha do banco ou token de acesso
para arquivos HTML/JavaScript.

## 2. Aplicar o banco

As migrações devem ser executadas nesta ordem:

1. `202607300001_secure_multitenant.sql`
2. `202607300002_bootstrap_guard.sql`
3. `202607300003_permissions.sql`

Com o Supabase CLI vinculado ao projeto, use o fluxo de migrações do próprio
Supabase. Alternativamente, revise e execute cada arquivo no SQL Editor.

Depois das migrações, o **primeiro login deve ser feito pelo proprietário da
1000 Beats**. Esse primeiro acesso cria a organização 1000 Beats e associa a ela
os clientes, catálogo, configurações e orçamentos legados. A Intereventos
continuará sendo cliente.

Os demais usuários existentes devem ser recriados ou vinculados pelo painel de
administração após o primeiro acesso.

## 3. Publicar a função administrativa

Defina o domínio autorizado da aplicação:

```text
supabase secrets set ALLOWED_ORIGINS=https://SEU-DOMINIO
```

Depois publique:

```text
supabase functions deploy admin-user
```

Não use `--no-verify-jwt`. A função também valida o usuário e o papel dentro da
organização antes de executar qualquer operação privilegiada.

## 4. Recuperação de senha

Nas configurações de autenticação do Supabase:

- configure o endereço de envio de e-mail;
- adicione `https://SEU-DOMINIO/reset-password.html` aos redirecionamentos permitidos;
- teste um e-mail real antes de liberar o sistema.

## 5. Publicar o frontend

1. Atualize `PUBLIC_APP_URL` em `js/config.js`.
2. Atualize `ALLOWED_ORIGINS` da Edge Function com o mesmo domínio.
3. Prefira uma hospedagem que permita cabeçalhos de segurança.
4. Publique todo o conteúdo desta pasta.
5. Não reutilize arquivos JavaScript antigos no cache/CDN.

O arquivo `_headers` contém uma configuração compatível com plataformas que
suportam esse formato. GitHub Pages não aplica esse arquivo; nesse caso use um
proxy/CDN capaz de configurar cabeçalhos.

## 6. Teste antes da primeira venda

- login do proprietário;
- login de colaborador sem acesso administrativo;
- criação, edição e exclusão de cliente;
- criação e compartilhamento de orçamento;
- link antigo `?n=1` não pode abrir documento;
- link novo `?t=UUID` deve abrir somente o orçamento correspondente;
- cliente de uma organização não pode ser consultado por outra;
- alteração e recuperação de senha;
- exportação CSV;
- PDF e compartilhamento no celular.

