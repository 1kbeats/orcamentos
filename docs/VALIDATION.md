# Validação da versão v6.4.0

Data da revisão: 10/08/2026

## Verificações concluídas

- sintaxe validada nos 25 arquivos JavaScript;
- `manifest.json` e `deno.json` validados como JSON;
- nenhum manipulador de evento inline (`onclick` e similares);
- nenhum bloco JavaScript inline;
- nenhum ID HTML duplicado;
- todos os 35 recursos do service worker existem;
- nenhuma chave `service_role` ou Secret key está presente no frontend;
- a única chave JWT no frontend tem papel `anon`;
- acesso anônimo a `index.html` redireciona para o login;
- formulário de login vazio exibe validação;
- `ver.html?n=1` não revela orçamento nem dados da Intereventos;
- tela de recuperação sem token recusa a alteração de senha;
- Estoque validado com 24 equipamentos e 52 movimentações simuladas;
- paginação de equipamentos e histórico limitada a 10 registros por página;
- busca, filtro por categoria e formulário de movimentação verificados;
- layout do Estoque validado em desktop e celular, sem rolagem horizontal;
- migração `202608100001_inventory.sql` aceita pelo Supabase em modo `dry-run`, sem alterar o banco remoto.

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
