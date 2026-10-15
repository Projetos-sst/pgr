# Deploy automático do PGR-e: develop e produção

O repositório principal é `Projetos-sst/pgr`. Os dois projetos Vercel recebem
código exclusivamente desse repositório pelo GitHub Actions:

| Branch    | Projeto Vercel     | Target Vercel | Serviços                                  |
| --------- | ------------------ | ------------- | ----------------------------------------- |
| `develop` | `develop-pgr-e`    | `production`  | Supabase e Clerk de testes                |
| `main`    | `pgr-e-production` | `production`  | Supabase próprio; Clerk de testes por ora |

São dois projetos separados, sem usar Preview ou ambientes personalizados.
O target interno chama-se Production nos dois; isso não mistura os projetos,
as URLs, as variáveis ou os bancos. A organização Vercel atual usa Hobby.

## Pipeline

PRs para `develop` e `main` mantêm o CI existente: formato, lint, typecheck,
build, unitários e integrações com Postgres efêmero. Não carregam credenciais reais.

Após um merge, o CD chama novamente esse CI sobre o commit integrado. Só publica
quando ele passa. A branch escolhe os secrets do projeto correspondente; não há
fallback entre testes e produção. A CLI baixa a configuração real, aplica as
migrations pendentes no banco do ambiente com `drizzle-kit migrate` (conexão
`DATABASE_URL_UNPOOLED` do próprio projeto Vercel), constrói o Next.js com
`--standalone` e publica o mesmo output com `--prebuilt`. Migration que falha
interrompe o CD antes do deploy; o drizzle aplica as pendentes numa transação.
Build e deploy ficam no mesmo job, preservando arquivos ocultos e links sem
exportar variáveis privadas em artefatos do Actions. O resumo registra URL e SHA.
O deploy roda numa cópia do output fora do checkout: sem `.git`, a CLI não envia
o autor do commit, que o plano Hobby bloqueia quando não é membro do time Vercel.
SHA e branch seguem nos metadados `githubCommit*`.

Deploys de uma branch são sequenciais. Actions → CD → Run workflow permite
republicar `develop` ou `main`; outras branches não publicam. `main` recebe
releases por PR `develop → main`, conforme o fluxo do repositório.

## Validar antes de cadastrar

Preencha `.env.deploy` com as credenciais do projeto de testes. O arquivo
`.env.deploy.production` contém as credenciais do projeto de produção criado
no mesmo time. Ambos são ignorados pelo Git e têm permissão `600`.

```bash
npm run deploy:validate
npm run deploy:validate -- --env-file .env.deploy.production
```

A validação faz apenas GET na API da Vercel: confirma autenticação, acesso,
ID do projeto e ID do time. Se `VERCEL_PROJECT_NAME` estiver preenchido,
confere também o nome esperado, para detectar um ID copiado de outro projeto.
Mostra o nome do projeto e o vínculo Git atual, sem imprimir token ou valores
secretos. Erros de token expirado, permissão, projeto errado e rede bloqueiam o
setup. Essa consulta não comprova que o build ou o deploy funcionarão: isso é
validado pela execução real do CD.

## Cadastrar no GitHub

Requer Node.js 24 e GitHub CLI autenticado com acesso aos secrets do PGR.
O setup sempre executa a validação online antes de gravar qualquer secret.
Não lê nem envia o `.env.local` da aplicação.

```bash
npm run deploy:setup
npm run deploy:setup -- --env-file .env.deploy.production
```

| Campo local         | GitHub: develop                    | GitHub: main               |
| ------------------- | ---------------------------------- | -------------------------- |
| `VERCEL_TOKEN`      | Secret `VERCEL_DEVELOP_TOKEN`      | Secret `VERCEL_TOKEN`      |
| `VERCEL_ORG_ID`     | Secret `VERCEL_DEVELOP_ORG_ID`     | Secret `VERCEL_ORG_ID`     |
| `VERCEL_PROJECT_ID` | Secret `VERCEL_DEVELOP_PROJECT_ID` | Secret `VERCEL_PROJECT_ID` |

`DEPLOY_ENVIRONMENT` escolhe `develop` ou `production`. `VERCEL_TARGET` deve
ser `production` em ambos; Preview é recusado. As variáveis antigas
`VERCEL_DEVELOP_TARGET`/`VERCEL_TARGET` não controlam o CD: o target está fixado
no workflow. O script mantém essas variáveis como metadados de cadastro.

Secrets ficam no nível do repositório, como no Postify, para não depender de
GitHub Environments pago em um repositório privado da organização Free.
São enviados por stdin e criptografados pelo `gh`, sem valores em argumentos
ou logs. Reexecutar altera somente os campos do ambiente selecionado.
`SUPABASE_ACCESS_TOKEN`, quando preenchido, não é enviado por esse script.

Após a integração da pipeline, `--deploy` cadastra e solicita o CD:

```bash
npm run deploy:setup -- --deploy
npm run deploy:setup -- --env-file .env.deploy.production --deploy
```

## Variáveis da aplicação e isolamento

As três credenciais Vercel permitem publicar; não substituem as credenciais da
aplicação. Cada projeto tem, no target Production, as variáveis do seu ambiente:

| Supabase | Projeto                | Usado por                                 |
| -------- | ---------------------- | ----------------------------------------- |
| testes   | `bhsppikrcjarbvmhzpna` | `develop-pgr-e` (`APP_ENV=sandbox`)       |
| produção | `fbuebpkqwhwvdkoakwje` | `pgr-e-production` (`APP_ENV=production`) |

Cada banco tem role `app_runtime` sem bypass de RLS (`DATABASE_URL`, pooler
6543), conexão owner para migrations (`DATABASE_URL_UNPOOLED`), chaves API e
buckets privados próprios. Produção usa, por decisão temporária, as chaves do
Clerk e do OpenRouter de testes.

Banco novo: crie a role `app_runtime` (`LOGIN NOBYPASSRLS`, membro de
`authenticated`/`anon`) antes do primeiro CD, porque a migration `0002` concede
permissões a ela. Depois disso, o CD aplica todas as migrations.

## Fonte e autor do commit

O CD de `Projetos-sst/pgr` é o único publicador; os projetos Vercel não têm
vínculo Git nativo. O deploy roda numa cópia do output fora do checkout: sem
`.git`, a CLI não envia o autor do commit. Assim qualquer pessoa do repositório
pode integrar e publicar, mesmo sem ser membro do time Vercel, que no plano
Hobby bloquearia o deploy. SHA e branch seguem nos metadados `githubCommit*`.

## Worker e conversor

O CD publica a aplicação Next.js. O worker contínuo e Gotenberg são processos
separados no VPS, com imagens contendo o template e suas fontes. Cada worker
precisa apontar para o banco/Storage do ambiente correto. Valide a fila do GED
até o download do PDF antes de considerar o fluxo publicado completo.

## Falhas e retomada

- Credencial ausente/inválida: setup falha antes de alterar o GitHub.
- CI ou build falhou: o deployment anterior permanece; corrija por PR.
- Publicação falhou: confira o job e reexecute o CD do mesmo commit.
- Rollback: selecione o deployment anterior no projeto correto. Não reverta o
  banco nem altere dados de clientes como parte do rollback da aplicação.

Referências: [Vercel CLI build](https://vercel.com/docs/cli/build),
[deploy](https://vercel.com/docs/cli/deploy),
[Supabase Management API](https://supabase.com/docs/reference/api/introduction).
