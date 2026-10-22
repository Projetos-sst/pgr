# 08 · Handoff: estado atual para retomada

> **Documento dinâmico. Atualizar ao fim de toda sessão importante**, usando o modelo da §3.
> As informações abaixo valem **no momento da última atualização**. Antes de agir, confira com `git` e com o Linear.

## 1. Estado atual

**Última atualização:** 2026-10-21 (noite), após integrar a develop pós-#112 na branch do Lote 01 (coordenador: Claude, sessão do Carlos).

```
DATA:                      2026-10-21 (noite)
LOTE:                      01 — Ficha de saúde ocupacional (PR_ABERTA, draft); Lote 00 segue EM_EXECUCAO
ISSUE:                     NOB-108 (In Progress no Linear, não alterado)
BRANCH:                    feature/NOB-108-ficha-saude-ocupacional
HEAD:                      o commit que introduziu esta versão do arquivo (git log -1 --format=%h -- docs/planning/medicina-ocupacional/geral/08-HANDOFF.md)
PR:                        #120 (draft, base develop) — https://github.com/Projetos-sst/pgr/pull/120
STATUS:                    PR_ABERTA

O QUE FOI CONCLUÍDO:       Merge normal de origin/develop (7793fca, merge da #112) na branch: commit 7ac18cd. Conflito só em
                           nav-menu.tsx, resolvido mantendo "Painel" + os dois itens da NOB-98. Nenhuma correção de código.
O QUE FOI VERIFICADO:      #112 MERGED em 2026-10-22 01:14 UTC; NOB-98 Done no Linear (01:18 UTC). develop tem 0054–0056.
                           #119/#115/#116/#117 MERGED nas branches da pilha, NÃO na develop: 0057–0059 fora da develop.
                           tenantAccess (novo na #112) não é usado pelo Lote 01; policies 0054–0056 não tocam as tabelas do lote.
TESTES EXECUTADOS:         npm run check no 7ac18cd → exit 0 (182 suítes / 1779 testes unit; lint 0 erros, 4 avisos antigos).
                           Integração (Postgres efêmero qa-pg16/sst_test, migrations 0000–0056) → 171 passed, 0 failed,
                           5 skipped; 1359 testes passed, 14 skipped. Medicina (Lote 01 + NOB-98): 7 suítes / 75 testes, 0 skipped.
                           Revisão de segurança independente: 0 CRITICAL/HIGH/MEDIUM/LOW.
TESTES PENDENTES:          spec Playwright automatizado (sem E2E_CLERK_*); jornada no navegador NÃO refeita na base nova
                           (porta 3001 ocupada por outro next dev; exige login do Carlos); telas de client e collaborator.
MIGRATIONS:                nenhuma própria (git diff origin/develop..HEAD sem db/schema nem db/migrations)
DECISÕES PENDENTES:        MED-DEC-31; MED-DEC-02…07; 08 e 26 (ordem das migrations da Medicina, agora com 0057–0059 fora da
                           develop); 09; 11, 15, 23, 24.
DEPENDÊNCIAS:              nenhuma de código para a #120. A PR traz 98 arquivos de docs/planning (ver REVIEW §5 item 5).
PRÓXIMA AÇÃO EXATA:        Conferir o CI no head atual da #120. Carlos pede a revisão ao Douglas; a PR sai de draft com o
                           aceite do Carlos (T01-18). Avisar o Rikelvin de que 0057–0059 não chegaram à develop.
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
