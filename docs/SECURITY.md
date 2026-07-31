# Política técnica de segurança

## Segredos

- O frontend aceita somente chave pública.
- Secret keys e `service_role` existem apenas no ambiente da Edge Function.
- Arquivos `.env` não entram no pacote ou no repositório.

## Autorização

- Toda linha de negócio pertence a `organization_id`.
- O banco aplica RLS mesmo quando um usuário tenta chamar a API diretamente.
- A interface não é considerada uma barreira de segurança.
- Administração de usuários exige papel `owner` ou `admin` no servidor.

## Links públicos

- Números de orçamento servem apenas para exibição.
- A visualização pública usa `public_token` aleatório.
- O RPC público retorna somente os campos necessários para o documento.
- Acesso direto anônimo às tabelas foi revogado.

## Resposta a incidentes

Se uma chave, senha ou token for exposto:

1. não o reutilize;
2. identifique onde foi publicado;
3. remova a causa;
4. substitua e revogue a credencial;
5. revise logs e alterações administrativas;
6. comunique usuários afetados quando aplicável.

## Rotina recomendada

- backup automatizado;
- revisão mensal de usuários ativos;
- alertas de falhas das Edge Functions;
- atualização trimestral das dependências;
- teste de restauração do backup;
- revisão de RLS antes de qualquer nova tabela.

