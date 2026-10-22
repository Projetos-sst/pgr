# 08 · Handoff: estado atual para retomada

> **Documento dinâmico. Atualizar ao fim de toda sessão importante**, usando o modelo da §3.
> As informações abaixo valem **no momento da última atualização**. Antes de agir, confira com `git` e com o Linear.

## 1. Estado atual

**Última atualização:** 2026-10-22, após o merge do Lote 01 (coordenador: Claude, sessão do Carlos).

```
DATA:                      2026-10-22
LOTE:                      01 — Ficha de saúde ocupacional: MERGED (não HOMOLOGADO); Lote 00 segue EM_EXECUCAO
ISSUE:                     NOB-108 (In Progress; não marcar Done: cobre a Medicina inteira, não só o Lote 01)
BRANCH:                    feature/NOB-108-ficha-saude-ocupacional (mergeada; não apagada)
PR:                        #120 MERGED — merge commit 15015fa em origin/develop (2026-10-22 02:46 UTC)
STATUS:                    MERGED

APROVAÇÃO:                 Douglas validou a entrega e autorizou o merge (informado pelo Carlos); Carlos autorizou ready+merge.
CD:                        run 39713265589 verde: CI, migrations (sem pendência nova), build e publicação na homologação.
                           CD da #112 (39704493258) também verde: 0054–0056 aplicadas na homologação pelo drizzle-kit.
                           Workflow Changelog falha nos dois merges por falta do input app-id (configuração, fora do lote).
MIGRATIONS:                nenhuma do lote. develop termina em 0056. 0057–0059 só nas branches codex/NOB-98/104/105/106/107,
                           sem PR aberta para a develop.
TESTES PENDENTES:          validação em homologação (T01-20); jornada no navegador sobre a develop atual; Playwright
                           protected (sem E2E_CLERK_*); telas de client e collaborator.
DOCS:                      este registro está na branch do lote (commit após 15015fa), ainda não na develop. Levar para a
                           develop junto com a primeira PR do Lote 02 (merge desta branch na feature/NOB-112, sem PR própria).
PRÓXIMA AÇÃO EXATA:        Lote 02: abrir feature/NOB-112-exame-empresa a partir da origin/develop atual; 1º incremento sem
                           migration (validação valid_until >= performed_at, I-4, com OK do Carlos). Migrations (K-1 company_id)
                           só depois de decidir com Douglas e Rikelvin a ordem frente a 0057–0059 (MED-DEC-08/26).
```

**Avisos desta sessão:**

- **Comentário na NOB-98:** versão 2 pronta em [04 §3](04-DECISOES-E-BLOQUEIOS.md#3-comentário-proposto-para-a-nob-98-não-publicado), **não publicada** (aguarda autorização).
- **Ambiente de QA local:** container `qa-pg16` (porta 5433) com os bancos descartáveis `sst_test` (integração) e `sst_qa_lote01`
  (navegador, dados fictícios). Dev server de QA em `localhost:3001` ligado a `sst_qa_lote01`. **O tenant vem do Supabase do
  `.env.local`** (`listTenantMembershipsByUser` usa o cliente Supabase): para QA local, replicar o seed sob o tenant do usuário.
- **Docker:** ao ligar o Docker Desktop, os containers do projeto site-pmpa subiram sozinhos (restart policy) e ocupam a porta 3000.
  A tentativa de pará-los foi bloqueada pela política do ambiente; o Carlos decide.
- **`node_modules`:** `npm install` instalou pacotes do lockfile que faltavam localmente (lockfile inalterado).
- **Prettier:** os documentos desta pasta agora passam no `format:check` do CI (só espaço em branco mudou).

## 2. Avisos para quem retomar

- **Trocar de branch no checkout principal:** a pasta `docs/planning/medicina-ocupacional/` agora está **commitada só nesta branch** (e no remoto). Se o checkout voltar para `develop`, ela some do working tree. **Não é perda**: volta ao retornar à branch.
- **Dev server:** o `npm run dev` é processo do usuário. Trocar de branch ou fazer merge com ele no ar causa um erro 500 transitório do Clerk na primeira requisição (artefato de cache). Parar o servidor antes de trocas de branch que mudem arquivos.
- **Worktree antiga:** `develop-ro` (somente leitura, no scratchpad da sessão, `d6b787c`) está limpa e pode ser removida com `git worktree remove <caminho>`. Recomendado, **não feito** (aguarda autorização, MED-DEC-22).
- **Docker:** o usuário autorizou ligar containers **existentes** quando necessário (ex.: Postgres para integração). Não criar container/imagem novos sem necessidade. O notebook sofre com pressão de memória: ligar só o necessário e desligar depois.
- **Migrations:** o Lote 01 é zero migration. Qualquer lote com migration segue o checklist de [06](06-GIT-MIGRATIONS-CD.md). **Merge em develop aplica na homologação.**
- **Linear:** nada foi alterado. O comentário proposto para a NOB-98 está em [04 §3](04-DECISOES-E-BLOQUEIOS.md#3-comentário-proposto-para-a-nob-98-não-publicado) e aguarda autorização.

## 3. Modelo de atualização ao fim de cada sessão

Copie o bloco, preencha **só com fatos verificados** e substitua a §1. Campo sem informação: escreva "nenhum" ou "não verificado",
nunca deixe um valor que pareça real.

```
DATA:                      (AAAA-MM-DD da sessão)
LOTE:                      (número e nome; estado conforme 02-ROADMAP-E-STATUS)
ISSUE:                     (NOB-xxx principal)
BRANCH:                    (nome exato)
HEAD:                      (SHA curto obtido com git rev-parse --short HEAD)
PR:                        (número, ou "nenhuma")
STATUS:                    (PLANEJADO | EM_EXECUCAO | BLOQUEADO | EM_QA | EM_REVISAO | PR_ABERTA | MERGED | HOMOLOGADO | PUBLICADO)

O QUE FOI CONCLUÍDO:       (itens do TASK.md do lote fechados nesta sessão, com evidência)
O QUE FOI VERIFICADO:      (comandos, telas, consultas; com resultado real)
TESTES EXECUTADOS:         (comando + resultado literal: suítes/testes/falhas; "nenhum" se não rodou)
TESTES PENDENTES:          (o que falta e por quê)
ARQUIVOS ALTERADOS:        (lista, ou referência ao commit)
MIGRATIONS:                (nome + ambiente afetado, ou "nenhuma")
DECISÕES TOMADAS:          (MED-DEC-NN com fonte e data)
DECISÕES PENDENTES:        (MED-DEC-NN que afetam o próximo passo)
DEPENDÊNCIAS:              (PRs/issues de outras pessoas que afetam o lote)
PRÓXIMA AÇÃO EXATA:        (um passo concreto, executável sem contexto extra)
```

Nunca registrar senhas, tokens, cookies ou dados médicos no handoff.
