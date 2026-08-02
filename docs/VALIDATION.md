# Validação da versão v6.3.0

Data da revisão: 01/08/2026

## Verificações concluídas

- sintaxe validada nos 17 arquivos JavaScript;
- `manifest.json` e `deno.json` validados como JSON;
- nenhum manipulador de evento inline (`onclick` e similares);
- nenhum bloco JavaScript inline;
- nenhum ID HTML duplicado;
- todos os 26 recursos do service worker existem;
- nenhuma chave `service_role` ou Secret key está presente no frontend;
- a única chave JWT no frontend tem papel `anon`;
- acesso anônimo a `index.html` redireciona para o login;
- formulário de login vazio exibe validação;
- `ver.html?n=1` não revela orçamento nem dados da Intereventos;
- tela de recuperação sem token recusa a alteração de senha.

## Validações que dependem da implantação

Os testes abaixo precisam ser executados após aplicar as migrações e publicar a
Edge Function no projeto Supabase:

- primeiro login e associação dos dados legados à organização 1000 Beats;
- isolamento real entre duas organizações autenticadas;
- criação e administração de usuários;
- criação, edição e exclusão de clientes, catálogo e orçamentos;
- consulta pública pelo novo token UUID;
- envio de e-mail e conclusão da recuperação de senha;
- geração final de PDF e compartilhamento em celular.

O aplicativo não deve ser colocado em produção antes dessas validações
integradas e da revogação da chave administrativa anteriormente exposta.
