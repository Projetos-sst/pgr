# 08 · Handoff: estado atual para retomada

> **Documento dinâmico. Atualizar ao fim de toda sessão importante**, usando o modelo da §3.
> As informações abaixo valem **no momento da última atualização**. Antes de agir, confira com `git` e com o Linear.

## 1. Estado atual

**Última atualização:** 2026-10-21, ao fim da organização documental pós-Fase 0 (coordenador: Claude, sessão do Carlos).

| Pergunta | Resposta |
|---|---|
| **Em qual lote estamos?** | **Lote 00** (`EM_EXECUCAO`, frente contínua de decisões) e **Lote 01** (`PLANEJADO`, pronto para começar). Ver [02](02-ROADMAP-E-STATUS.md) |
| **Qual é a branch?** | `feature/NOB-108-ficha-saude-ocupacional`, criada a partir de `origin/develop` (`d6b787c`) em 2026-10-21, no checkout principal (`pgr/`). Publicada em `origin` como backup |
| **Qual é o último commit?** | Base de código: `d6b787c` (merge da PR #118). Por cima dela há **um único commit, só de documentação**: o que introduziu este arquivo. Para obter o SHA: `git log -1 --format=%H -- docs/planning/medicina-ocupacional/geral/08-HANDOFF.md`. **Nenhum código funcional foi alterado** |
| **Existe PR?** | **Não, de propósito.** A PR do Lote 01 só será aberta após implementação + QA (regra da missão de organização) |
| **Última ação concluída** | Estrutura permanente criada: `geral/` (9 docs), `lotes/00…07/` (7 docs cada), `templates/` (7 modelos), índice no `README.md`. Resposta parcial do Expedito registrada como MED-DEC-01 (`PARCIALMENTE_RESPONDIDA`) |
| **O que foi verificado** | Ver tabela abaixo |
| **O que está bloqueado** | Lote 02 (só as migrations, MED-DEC-08); Lote 03 (MED-DEC-02…07, 10, 13); Lote 04 (03 + MED-DEC-12, 14, 19); Lote 05 (NOB-98); Lote 06 (MED-DEC-21). **O Lote 01 não tem bloqueio de produto nem técnico.** Pendência de gestão: o aceite do Douglas ao escopo (MED-DEC-25), recomendado antes do código e obrigatório na revisão da PR. O escopo já foi aceito pelo Carlos |
| **Próxima tarefa exata** | Lote 01, [TASK](../lotes/01-ficha-saude-ocupacional/TASK.md) item 1: **pré-check Git**. Rodar `git fetch origin --prune` e conferir se `origin/develop` ainda é `d6b787c`. Se avançou: parar o dev server, fazer merge de `origin/develop` na branch (sem rebase/force) e reconferir migrations e PRs concorrentes (sobretudo a #112) |
| **Quais testes precisam rodar** (no Lote 01) | `npm run check`; `npm run test:integration` com Postgres efêmero, conferindo que **nenhuma suíte saiu como `skipped`**; Playwright protected com dados fictícios; Chrome DevTools (console/network) em 375/768/1440. Detalhe no [QA do Lote 01](../lotes/01-ficha-saude-ocupacional/QA.md) |
| **Qual decisão externa estamos aguardando** | Para destravar os lotes seguintes: MED-DEC-02…07 (autorização de validação), MED-DEC-08 (ordem da #112), MED-DEC-10 (dono da identidade), MED-DEC-13 (Lista C). Nenhuma bloqueia o Lote 01. Ver [04](04-DECISOES-E-BLOQUEIOS.md) |

**Verificações desta sessão:**

| Verificação | Resultado |
|---|---|
| Git (21/10) | `develop` local = `origin/develop` = `d6b787c`; nada novo mergeado desde a Fase 0; última migration `0053_company_module_access` |
| PRs | Abertas: #112 (NOB-98, sem CI, base = branch do NOB-100), #115/#116/#117 (drafts). Nenhuma PR nova |
| `cd.yml` | Relido: push em develop/main → `drizzle-kit migrate` antes do deploy ([06](06-GIT-MIGRATIONS-CD.md)) |
| Linear (MCP) | Estados das issues inalterados; NOB-98 com 0 comentários (a resposta do Expedito ainda **não** está no Linear) |
| Fase 0 | Os 12 documentos e as 6 capturas foram preservados. Os hashes conferem com a linha de base, exceto o `README.md`, que ganhou de propósito uma seção de navegação no topo e um título novo; o corpo original foi conferido byte a byte. A linha de base foi tirada **depois** da remoção dos e-mails em `AUDIT-LINEAR-QA.md`, a única edição de conteúdo na Fase 0 |
| Dados sensíveis | E-mails pessoais removidos de `AUDIT-LINEAR-QA.md`; as capturas contêm só dados fictícios do protótipo; nenhum segredo |
| Testes da aplicação | **Não executados** (nenhum código mudou) |

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
