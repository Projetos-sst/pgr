# Deploy automático do PGR-e na Vercel

Adaptado do CD do Postify e do template Next.js `launchpad-frontend`.
O PGR é Next.js com rotas de servidor no mesmo projeto; não usa o proxy de SPA
do Postify nem o deploy Koyeb do backend.

## Fluxo

- PR para `develop` ou `main`: mantém lint, formatação, typecheck, unitários,
  integrações com Postgres efêmero e build, sem carregar as variáveis reais da Vercel.
- Merge/push integrado em `develop` ou `main`: o CD chama o mesmo CI por
  `workflow_call`. Após todos os jobs passarem, baixa as configurações do projeto,
  faz `vercel build --standalone` e publica esse output com `vercel deploy --prebuilt`.
- Execução manual: Actions → CD → Run workflow, selecionando `develop` ou `main`.
  Outras branches não publicam. Não precisa fazer deploy pela máquina local.
- Deploys da mesma branch são sequenciais. CI/build com falha impede publicação.
  A CLI espera a conclusão da publicação; o resumo registra URL, target e SHA.

Build e publicação ficam no mesmo job, preservando arquivos ocultos e links das
funções Next.js. Não há upload das variáveis reais para artefatos do Actions.

## Preencher e cadastrar as credenciais

```bash
cp .env.deploy.example .env.deploy
# Preencha .env.deploy no editor, sem colar os valores no terminal.
npm run deploy:setup -- --check
npm run deploy:setup
```

Requer Node.js 24 e GitHub CLI (`gh`) autenticado com acesso aos secrets de
`Projetos-sst/pgr`. O `.env.deploy` é ignorado pelo Git; o script ajusta sua
permissão para `600`. Ele não lê nem envia o `.env.local` da aplicação.

Preencha `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` com os valores do
**PGR**, como no Postify. Não copie os IDs do Postify. O token deve ter acesso ao
time proprietário do projeto PGR. Não é preciso autenticar a CLI da Vercel na
máquina para executar o setup; a publicação usa o token no GitHub Actions.

Use `DEPLOY_ENVIRONMENT=develop` para homologação. Para produção, troque os
valores pelos do projeto de produção, mude para `DEPLOY_ENVIRONMENT=production`
e rode o script novamente. O script cadastra no **nível do repositório**:

| Configuração local  | GitHub: develop                    | GitHub: main               |
| ------------------- | ---------------------------------- | -------------------------- |
| `VERCEL_TOKEN`      | Secret `VERCEL_DEVELOP_TOKEN`      | Secret `VERCEL_TOKEN`      |
| `VERCEL_ORG_ID`     | Secret `VERCEL_DEVELOP_ORG_ID`     | Secret `VERCEL_ORG_ID`     |
| `VERCEL_PROJECT_ID` | Secret `VERCEL_DEVELOP_PROJECT_ID` | Secret `VERCEL_PROJECT_ID` |
| `VERCEL_TARGET`     | Variable `VERCEL_DEVELOP_TARGET`   | Variable `VERCEL_TARGET`   |

O repositório privado está em uma organização GitHub Free. Secrets de
GitHub Environments exigem plano pago nesse caso, por isso usamos secrets de
repositório como no Postify. Os nomes distintos separam homologação e produção;
a seleção de chave no workflow não faz fallback para o outro ambiente quando
um secret está ausente. Veja a [disponibilidade de environments no GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

Os secrets são enviados por stdin e criptografados pelo `gh`, sem valores em
argumentos ou logs. O script confirma os nomes cadastrados, sem ler os valores
secretos de volta. Reexecutar atualiza somente as quatro configurações do
ambiente selecionado; não altera branch protection, revisores ou outros secrets.

Após a pipeline ser integrada, para cadastrar e disparar o CD de uma vez:

```bash
npm run deploy:setup -- --deploy
```

Essa opção dispara `cd.yml` na `develop` ou `main`, conforme o ambiente;
não faz merge de PR nem publica uma branch de trabalho. Sem `--deploy`, só
cadastra a configuração; os próximos merges disparam o CD normalmente.
`--check` valida apenas o formato local, sem testar o token na Vercel.

## Projetos e targets

`develop` pode usar `preview` no mesmo projeto da produção, ou `production` em
um projeto separado de homologação. Confirme a configuração existente antes de
preencher os IDs. A URL informada para homologação é
`https://develop-pgr-e-tan.vercel.app`; ela sozinha não comprova propriedade ou
target. Para `main`, o script e o workflow exigem `VERCEL_TARGET=production`.

Os IDs estão em `.vercel/project.json` de um projeto previamente vinculado
ou nas configurações do projeto na Vercel. Nunca versione tokens ou `.vercel`.
Mantenha as variáveis de runtime na Vercel, incluindo Clerk, Supabase, banco e
`GOTENBERG_URL`/`GOTENBERG_TOKEN`. Se develop usar Preview, configure as variáveis
por branch e um domínio/alias de branch para manter o endereço estável.

## Ativação sem interromper o deploy existente

1. Preencha `.env.deploy` e rode `npm run deploy:setup` para cada ambiente.
2. Integre a pipeline e confira o CD da `develop` até a publicação ficar pronta.
3. Só após o primeiro CD aprovado, desligue o auto-deploy da integração Git no
   projeto Vercel (ou configure `git.deploymentEnabled: false`). Isso evita dois
   publicadores disputando a mesma branch.
4. Confira domínio estável, login e exportação PDF com um usuário autorizado.

O repositório não desliga o Git deploy antes de os acessos estarem configurados.
O CI da PR não substitui o CI do commit integrado executado pelo CD.

## Worker e conversor

Este CD publica a aplicação web e suas rotas Next.js. O processo contínuo
`worker/index.ts` e Gotenberg são serviços separados; este workflow não os
publica nem aplica migrations automaticamente. As imagens `Dockerfile.worker`
e `Dockerfile.gotenberg` devem usar a mesma versão de código, com o worker
apontando para o banco/Storage corretos e o conversor em `GOTENBERG_URL`.
Valide o job do GED até o download do PDF antes de considerar a integração
publicada completa.

## Falhas e retomada

- Configuração ausente: o CD falha indicando o nome faltante, sem imprimir valores.
- Vercel 403/404: confira escopo do token, time e ID do projeto.
- CI/build falhou: corrija por PR; o deploy anterior permanece ativo.
- Publicação falhou: consulte o job e a Vercel; reexecute o CD do mesmo commit.
- Rollback: use o deployment anterior no projeto correto da Vercel. Não reverta
  banco nem altere dados de clientes como parte do rollback da aplicação.

Referências: [CLI build](https://vercel.com/docs/cli/build),
[CLI pull](https://vercel.com/docs/cli/pull),
[CLI deploy](https://vercel.com/docs/cli/deploy).
