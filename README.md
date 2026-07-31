# 1K Beats Orçamentos — versão segura v6

Esta versão transforma o aplicativo original em uma base SaaS multiempresa.

## Relação dos dados atuais

- **1000 Beats Audio, Vídeo e Iluminação Ltda.** é a empresa prestadora.
- **Intereventos Comunicação Ltda.** permanece como cliente da 1000 Beats.
- Uma nova organização/tenant só será criada quando outra empresa contratar o SaaS.

## Principais mudanças

- chave administrativa removida do navegador;
- isolamento por organização com Row Level Security;
- links públicos por token aleatório, sem números enumeráveis;
- administração de usuários transferida para uma Edge Function;
- permissões `owner`, `admin` e `member`;
- recuperação de senha por e-mail;
- tratamento correto de respostas HTTP;
- proteção contra conteúdo HTML injetado;
- exportação CSV de clientes e orçamentos;
- configuração da empresa por organização;
- política CSP e cache PWA atualizado.

## Importante

O frontend desta pasta só deve substituir a versão publicada **depois** que as
migrações e a Edge Function forem aplicadas no Supabase. Até lá, use-o apenas
localmente para homologação.

Antes de qualquer publicação, siga [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Estrutura

- `index.html`, `login.html`, `ver.html`: aplicação web;
- `js/`: regras do frontend;
- `supabase/migrations/`: esquema, migração dos dados e políticas RLS;
- `supabase/functions/admin-user/`: operações administrativas protegidas;
- `docs/`: implantação, segurança e checklist LGPD.

## O que não está incluído

- cobrança recorrente e checkout;
- domínio definitivo;
- textos jurídicos revisados por advogado;
- credenciais ou chaves secretas;
- aplicação automática das mudanças no projeto Supabase.

