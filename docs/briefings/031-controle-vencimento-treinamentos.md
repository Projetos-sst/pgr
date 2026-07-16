# Briefing US3 — Controle de vencimento / reciclagem

> Issue **#31**. Depende de US2 (#30). **Zero migration.** É a fatia que **firma o consumo de D2**
> (`classifyTrainingStatus`) e o helper D5 ("último registro"). Decisões **D2, D5, D7** do
> [brainstorming](./fase04-treinamentos-brainstorming.md).

## Escopo

Visão consolidada (só leitura) dos treinamentos vencidos e a vencer, por funcionário, com status
visual. Identifica quem precisa reciclar. Expõe também uma **query de resumo** para o dashboard (Fase 7).

## Leitura (Server Component + queries `withOrg`, sem escrita)

- **Helper D5** — "último registro por (funcionário, treinamento)": `ROW_NUMBER() OVER (PARTITION BY
employee_id, training_id ORDER BY completed_at DESC)`, pegando `rn = 1`. Compartilhado com US4.
- Cada linha passa por **`classifyTrainingStatus` (D2)** → `expired | due_soon | ok`
  (`missing` não ocorre aqui — toda linha tem registro).
- **`single` (`valid_until IS NULL`) é excluído** do cômputo de vencimentos (`WHERE valid_until IS NOT
NULL`) e nunca aparece como vencido.

## UI

- Colunas: Funcionário · Treinamento · Data de Realização · Validade · Status.
- Status visual: **Vencido** (vermelho) · **A vencer** (amarelo) · **Em dia** (verde).
- Filtros: por funcionário e por **janela** (`dueWithinDays` = 30/60/90) — **um** parâmetro de query,
  não três queries (KISS).
- Estado vazio positivo quando tudo está em dia.

## Query de resumo (para o dashboard — D7)

`{ expired: number, dueSoon: number }` (contagens escopadas por tenant), reusável pelo painel de
pendências da Fase 7. **Nada além disso** — sem central de notificações, sem cron nesta fatia (YAGNI).

## Regras verificáveis

- Vencidos e a vencer listados corretamente pela periodicidade/`valid_until`.
- `single` (`valid_until = null`) nunca aparece como vencido.
- Reciclagem: só o **último** registro conta (D5) — registro antigo não contamina o status.
- Filtros por funcionário e janela funcionam.
- Dados escopados pelo tenant ativo; query de resumo disponível para consumo.

## Testes

- **Unit**: `classifyTrainingStatus` nas fronteiras (hoje, hoje+30, hoje+90) + exclusão de `single` +
  precedência do último registro.
- **Integração (Postgres efêmero)**: lista e resumo corretos por status; `single` fora do cômputo;
  reciclagem move o status; isolamento cross-tenant (dados de outro org nunca aparecem).

## Referência

`domains/pgr/trainings.ts` (D2) · `computeRunningBalance` de `stock-movements` (exemplo de window
function pura já no repo) · `.specs/010-stock-movements/` (histórico com derivação na leitura).
