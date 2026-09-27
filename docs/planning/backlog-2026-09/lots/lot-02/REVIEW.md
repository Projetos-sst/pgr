# Lote 2 — Review

**Branch única:** `feature/lot-02-nr09-pgr-pdf` (renomeada de `docs/lot-02-audit-plan`, preservando o
commit da auditoria) · **Base:** `develop` em `1d7c42e` · **Data:** 27/09/2026.

## Entregue

| Issue   | Situação                                                                                   |
| ------- | ------------------------------------------------------------------------------------------ |
| **#39** | **Completa** — avaliação quantitativa NR-09 ponta a ponta (schema, domínio, API, UI, PDF)  |
| **#47** | **Parcial** — seções 1, 2, 3 e 5 do documento; seção NR-17 continua bloqueada pela **#40** |

## Arquivos principais

**#39**

- `src/shared/db/schema/risks.ts` — enum `nr09_conclusion`, 5 colunas em `risk_assessments`, 2 CHECKs.
- `src/shared/db/migrations/0049_nr09_evaluation.sql`.
- `src/shared/domains/pgr/nr09.ts` (novo) — elegibilidade, rótulos, formatação e sugestão de conclusão.
- `src/shared/domains/pgr/risk-assessment.ts` — campos e regras no schema Zod.
- `src/shared/db/repositories/risk-assessments.ts` — persistência + **elegibilidade por agente no
  servidor**.
- `src/app/(protected)/risks/[id]/assessments/**` — bloco NR-09 no formulário e nas duas páginas.
- `docs/api/api-design.md`, `docs/api/sst-manager.postman_collection.json`.

**#47**

- `src/shared/db/migrations/0050_measure_why_cost.sql` — `action_why`, `action_cost`.
- `src/shared/domains/pgr/pgr-pdf-template.ts` — seções nomeadas, identificação, NR-09, 5W2H completo.
- `src/shared/domains/pgr/pgr-consolidated.ts` + `src/shared/db/repositories/pgr-consolidated.ts` —
  empresa/unidade completas e os campos novos, sem consulta extra.
- `src/app/(protected)/risks/[id]/control-measures/**` — por quê e custo no formulário.

**Ajuste visual (pedido durante o QA)**

- Os três formulários do fluxo de risco (risco, avaliação, medida) usavam layout próprio
  (`max-w-2xl` encostado à esquerda) e agora usam as primitives de `_ui/form` com o wrapper padrão de
  940px — mesmo visual do cadastro de empresa. Sem mudança de comportamento.

## Migrations

| Arquivo                     | Conteúdo                                                       |
| --------------------------- | -------------------------------------------------------------- |
| `0049_nr09_evaluation.sql`  | `CREATE TYPE nr09_conclusion` + 5 colunas + 2 CHECKs           |
| `0050_measure_why_cost.sql` | `action_why text`, `action_cost numeric` em `control_measures` |

Nenhuma policy nova: as duas tabelas já têm isolamento por `org_id` e as colunas herdam. Aplicadas do
zero em Postgres efêmero pela suíte de integração (que roda todas as migrations em ordem) e
manualmente no banco de desenvolvimento — ver "Dívidas" abaixo.

## Decisões e como foram implementadas

1. **D-Q1 — dados NR-09 em `risk_assessments`.** Sem tabela dedicada; a avaliação já é o registro
   datado e o consolidado já sabia achar a vigente.
2. **D-Q2 — conclusão humana.** `suggestNr09Conclusion` é função pura chamada **pela UI**; o
   repositório grava o que veio e nunca deriva. Provado no QA gravando conclusão contrária à sugestão.
3. **D-Q3 — 5W2H 7 de 7.** `action_why` e `action_cost` na medida; "onde" derivado do GES. Sem
   backfill e sem obrigatoriedade retroativa.
4. **Elegibilidade NR-09 no servidor**, não só na tela — a API recusa agente fora da norma.
5. **Numeração sequencial das seções do PDF**, em vez de deixar um "4. NR-17" vazio.

## Desvios do PLAN

- **Duas PRs → uma só.** O usuário mudou a estratégia no meio do lote: tudo numa branch, uma PR final.
- **Ajuste visual dos formulários** entrou no lote (não estava no PLAN) a pedido do usuário, ao ver o
  formulário de avaliação desalinhado do padrão do sistema em 1440px.
- **REST de avaliações**: os dois casos novos foram escritos em
  `rest-risk-assessments.test.ts`, que está em `testPathIgnorePatterns` desde antes (limitação
  conhecida do harness REST-via-Jest). A validação REST foi feita no QA, pelo navegador autenticado.

## Testes

| Suíte                                                    | Resultado                                    |
| -------------------------------------------------------- | -------------------------------------------- |
| `npm run check` (format + lint + typecheck + unit)       | **verde** — 1 297 testes, 0 erros            |
| Unit novos                                               | 31 (domínio NR-09 + schema) + 10 (template)  |
| Integração `risk-assessments` (Postgres efêmero)         | 31 testes, inclui CHECKs, cross-tenant e RLS |
| Integração `pgr-editor` / `reports` / `control-measures` | 107 + 4 novos                                |
| `npm run build`                                          | **verde**                                    |
| QA Playwright                                            | ver [QA.md](QA.md) — aprovado                |

## Riscos e regressões avaliadas

- **PDF é entregável ao cliente:** conferido texto extraído dos **dois** geradores (rota e worker) —
  idênticos.
- **Avaliação qualitativa** (a maioria) segue exatamente como era: o bloco novo é opcional e barrado
  por CHECK no critério errado.
- **#42 (cobertura do plano)** intacta: a regra de responsável/prazo em risco moderado+ continua
  bloqueando (foi ela que recusou, corretamente, uma medida sem responsável no QA).
- **Ponte #51** não foi tocada e não alimenta o PDF.

## Bloqueio remanescente

**#47 não fecha.** Falta a seção 4 (NR-17), que depende da **#40** — sem implementação nenhuma hoje. O
contrato de dados esperado está no [AUDIT](AUDIT.md#seção-4--nr-17).

## Dívidas registradas (pré-existentes, fora do escopo)

1. **Journal do drizzle defasado no banco de desenvolvimento**: `drizzle-kit migrate` falha porque as
   migrations `0046`–`0048` foram aplicadas fora do drizzle (os objetos existem, o journal parou em
   02/09). Para o QA, as duas migrations do lote foram aplicadas direto pela conexão owner. **Não
   afeta CI nem produção** — a suíte de integração aplica tudo do zero. Merece uma issue de
   reconciliação.
2. **Ponte #51** fabrica `who`/`why`/`where` em `action_plans` (mantida de propósito neste lote).
3. `rest-*.test.ts` fora do CI por limitação do harness.
