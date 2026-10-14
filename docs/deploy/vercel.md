# Deploy automático do PGR-e na Vercel

O fluxo foi adaptado de `postify-frontend/.github/workflows/cd.yml`, do template
Next.js `launchpad-frontend` e do gate de CI do backend do Postify.
O PGR é Next.js com rotas de servidor no mesmo projeto: não
usa o proxy de SPA do Postify nem o deploy Koyeb do backend.

## Fluxo

- PR para `develop` ou `main`: lint, formatação, typecheck, unitários, integrações
  com Postgres efêmero e build, sem acesso às variáveis reais da Vercel.
- Push integrado em `develop` ou `main`: o CD executa o mesmo CI por
  `workflow_call`. Só após todos os jobs passarem, baixa as configurações do
  projeto correto, faz `vercel build --standalone` e publica esse output com
  `vercel deploy --prebuilt`. O deploy espera a conclusão da Vercel.
- Execução manual: Actions → CD → Run workflow, escolhendo `develop` ou `main`.
  Outras branches não publicam. Não é necessário fazer deploy pela máquina local.
- Deploys da mesma branch são sequenciais. Falha de CI ou build impede publicação.

O build e a publicação ficam no mesmo job, preservando arquivos ocultos e links
do output Next.js. Não há upload das variáveis reais para artefatos do Actions.
O resumo da execução registra URL, ambiente e SHA publicado.

## Configuração inicial

Copie `.env.deploy.example` para `.env.deploy` e preencha os valores do **PGR**.
Esse arquivo é ignorado pelo Git; o script ajusta sua permissão para `600`.
Ele não lê nem envia o `.env.local` da aplicação.

```bash
cp .env.deploy.example .env.deploy
# Preencha .env.deploy no editor, sem colar os valores no terminal.
npm run deploy:setup -- --check
npm run deploy:setup
```

Requer Node.js 24 e GitHub CLI (`gh`) autenticado com acesso administrativo ao
repositório `Projetos-sst/pgr`. O script cria o environment quando necessário,
restringe um environment novo à branch correspondente e cadastra os três secrets
e a variável abaixo. Environments existentes mantêm revisores e proteções.
Os secrets são enviados por stdin e criptografados pelo `gh`, sem valores em
argumentos ou logs. Ao terminar, o script confirma os nomes cadastrados no GitHub.
Não é necessário autenticar a CLI da Vercel na máquina para executar esse setup.

Use `DEPLOY_ENVIRONMENT=develop` para homologação. Para produção, preencha os
valores do projeto de produção, mude para `DEPLOY_ENVIRONMENT=production` e rode
novamente. Os secrets ficam isolados em cada environment, com os mesmos nomes
do Postify. Confira as restrições de branch no GitHub se o environment já existia.

Após a pipeline ser integrada, para cadastrar e disparar o CD de uma vez:

```bash
npm run deploy:setup -- --deploy
```

Essa opção dispara `cd.yml` na `develop` ou `main`, conforme o environment;
ela não faz merge de PR nem publica uma branch de trabalho. Sem `--deploy`, o
script só cadastra a configuração; os próximos merges disparam o CD normalmente.
`--check` valida apenas o formato local, sem testar a validade do token na Vercel.

Valores que serão cadastrados em **cada environment**:

| Tipo     | Nome                | Valor                                        |
| -------- | ------------------- | -------------------------------------------- |
| Secret   | `VERCEL_TOKEN`      | Token autorizado no time proprietário do PGR |
| Secret   | `VERCEL_ORG_ID`     | ID do time/conta do projeto                  |
| Secret   | `VERCEL_PROJECT_ID` | ID do projeto daquele ambiente               |
| Variable | `VERCEL_TARGET`     | `production` ou `preview`, conforme abaixo   |

Não copie IDs do Postify. O token precisa alcançar o projeto PGR. Um token válido
na conta pessoal sem acesso ao time proprietário não é suficiente.

`develop` pode usar `preview` no mesmo projeto da produção, ou `production` em
um projeto separado de homologação. Confirme a configuração existente antes de
preencher os IDs. O endereço informado para homologação é
`https://develop-pgr-e-tan.vercel.app`; a URL sozinha não comprova propriedade nem
o target configurado na Vercel. Para `main`, use sempre `production`.

Use `vercel link` no projeto correto e confira `.vercel/project.json` para obter
os IDs. Tokens ficam no painel da Vercel. Não versione tokens, `.vercel` ou envs.
Mantenha as variáveis de runtime no ambiente correspondente da Vercel, incluindo
Clerk, Supabase, banco e `GOTENBERG_URL`/`GOTENBERG_TOKEN`.

Se `develop` usar Preview, configure as variáveis por branch e um domínio/alias
de branch na Vercel para manter um endereço estável. A pipeline passa
`--git-branch=develop` no pull e os metadados Git no deploy.

## Ativação sem interromper o deploy existente

1. Confirme conta/time, projetos, targets e variáveis existentes na Vercel.
2. Configure os dois environments do GitHub e seus segredos. Não use um
   `VERCEL_PROJECT_ID` global para dois projetos distintos.
3. Integre a pipeline e confira o CD de `develop` até a publicação ficar pronta.
4. Depois do primeiro CD aprovado, desligue o auto-deploy da integração Git no
   projeto Vercel (ou configure `git.deploymentEnabled: false`). Assim, o Actions
   passa a ser o único publicador, sem dois deploys disputando a mesma branch.
5. Confira o domínio estável, login e exportação PDF com um usuário autorizado.

O repositório não desliga o Git deploy antes de os acessos estarem configurados.
As regras de merge e revisão continuam válidas; CI aprovado em PR não substitui
o CI do commit integrado executado pelo CD.

## Worker e conversor

Vercel publica a aplicação web e suas rotas Next.js. O processo contínuo
`worker/index.ts` e o conversor Gotenberg são serviços separados. Este workflow
não declara esses serviços publicados nem aplica migrations automaticamente.
As imagens `Dockerfile.worker` e `Dockerfile.gotenberg` devem usar a mesma versão
de código, com o worker apontando para o banco/Storage do ambiente e o conversor
configurado em `GOTENBERG_URL`. Valide o job do GED até o download do PDF antes de
considerar a integração publicada completa.

## Falhas e retomada

- Configuração ausente: o CD falha indicando o nome faltante, sem imprimir valores.
- Vercel 403/404: confira escopo do token, time e ID do projeto.
- CI/build falhou: corrija por PR; o deploy anterior permanece ativo.
- Publicação falhou: consulte o job e a Vercel; reexecute o CD do mesmo commit.
- Rollback: use o deployment anterior no projeto correto da Vercel. Não reverta
  banco ou altere dados de clientes como parte do rollback da aplicação.

Referências: [CLI build](https://vercel.com/docs/cli/build),
[CLI pull](https://vercel.com/docs/cli/pull),
[CLI deploy](https://vercel.com/docs/cli/deploy).
