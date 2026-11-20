# NOB-127 — Ambiente de homologação

Escrito em 20/11/2026. A NOB-127 pede um ambiente online para testes reais, com acesso restrito à equipe, a aplicação e os serviços respondendo, e a versão e as instruções registradas. Ela não autoriza publicar em produção.

## Situação

O ambiente já existe e recebe a `develop` pelo CD (`docs/deploy/vercel.md`).

| Item                 | Valor                                                                                                   | Conferido em 20/11/2026                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| URL                  | https://develop-pgr-e-tan.vercel.app                                                                     | Responde `401` com `WWW-Authenticate: Basic realm="Sandbox"` sem senha     |
| Projeto Vercel       | `develop-pgr-e`, `APP_ENV=sandbox`                                                                      | Pelo histórico do CD                                                       |
| Banco                | Supabase de testes `bhsppikrcjarbvmhzpna`                                                                | Pela documentação de deploy; credenciais não lidas                         |
| Versão publicada     | `3c998b3f` (merge da PR #172), deploy de 15/11/2026                                                      | Último CD com sucesso na `develop`, mesmo commit da ponta da branch         |
| Acesso               | Senha básica do `proxy.ts` (`SANDBOX_BASIC_AUTH_USER/PASSWORD`) e depois login do Clerk de testes         | A senha básica responde `401` sem credencial                              |
| PDF e fila           | Gotenberg e worker no VPS (`docker-compose.homolog.yml`)                                                 | **Não conferido**: exige acesso ao VPS                                     |
| Pagamento            | Desligado (sem `STRIPE_SECRET_KEY`, resposta `503`)                                                      | Pelo código; a variável do projeto não foi lida                            |

## Como saber qual versão está no ar

1. GitHub → Actions → CD → última execução com sucesso na `develop`. O resumo mostra a branch, o commit e a URL do deploy.
2. Na Vercel, o deployment carrega o commit nos metadados `githubCommitSha` e `githubCommitRef`.

Não foi criada rota nova para mostrar a versão: as duas fontes acima já dão o commit exato, e uma rota pública revelaria a versão para quem não tem acesso.

## Como testar

### Antes de começar

- Pedir ao administrador da Vercel a senha básica da homologação. Ela nunca vai para o repositório, o Linear ou o chat.
- Ter um usuário no Clerk de testes. Quem administra o Clerk cria a conta; não usar e-mail pessoal de cliente.
- Usar só dados fictícios. A homologação nunca recebe dado real de cliente, trabalhador ou exame.

### Roteiro mínimo

| #   | Passo                                                   | Esperado                                                                  |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Abrir a URL sem senha                                   | Pedido de senha básica                                                    |
| 2   | Entrar com a senha básica e depois com o Clerk de testes | Tela inicial do escritório                                               |
| 3   | Cadastrar uma empresa por CNPJ fictício válido          | Empresa criada; consulta de CNPJ preenche os dados públicos               |
| 4   | Cadastrar função, GES e um funcionário                  | Registros listados na empresa                                             |
| 5   | Abrir um PGR e ir em Documentos e PDF → Baixar PDF      | PDF baixado. Se falhar, conferir o Gotenberg e o worker no VPS            |
| 6   | Abrir uma tela de Medicina                              | Acesso clínico bloqueado até a identidade do médico ser verificada (NOB-158 e NOB-162) |
| 7   | Abrir Planos                                            | Sem cobrança real; o catálogo só aparece com `COMMERCIAL_CATALOG_ENABLED=true` |

Os roteiros completos ficam nas issues de teste: NOB-128 (fluxo completo), NOB-129 (documentos e restrições) e NOB-138 (cobrança em modo teste).

## O que falta para fechar a NOB-127

| Falta                                                                   | Quem                         |
| ----------------------------------------------------------------------- | ---------------------------- |
| Confirmar que `DEV_API_AUTH_BYPASS` não está `true` no `develop-pgr-e`   | Quem administra a Vercel     |
| Confirmar o Gotenberg e o worker do VPS apontando para o banco de testes, até o download do PDF (passo 5) | Quem administra o VPS        |
| Rodar o roteiro mínimo com a senha básica e um usuário de teste, e anotar o resultado aqui | Equipe com acesso            |
