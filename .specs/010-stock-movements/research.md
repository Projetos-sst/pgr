# Research — Movimentações de estoque e histórico (`stock_movements`)

Fase 0 do `/speckit-plan`. Decisões técnicas, com base na spec, no briefing
(`docs/briefings/briefing-stock-movements.md`), no modelo real da 008 (`src/shared/db/schema/epis.ts`)
e nos padrões da 007/009. Não há `NEEDS CLARIFICATION` em aberto — todas as ambiguidades foram
travadas na seção **Clarifications** da spec.

## D1 — Atomicidade da escrita de saldo (transação + `SELECT … FOR UPDATE`)

- **Decisão**: cada registro (entrada ou saída) roda numa **única transação** (`withOrg` já abre
  transação): (1) `SELECT … FOR UPDATE` da linha de `epi_stock` (trava); (2) calcula `novoSaldo`;
  (3) valida `novoSaldo >= 0`; (4) `INSERT` em `stock_movements`; (5) `UPDATE epi_stock.balance`.
  Falha → rollback total.
- **Rationale**: garante que nunca exista movimento sem ajuste de saldo (nem o inverso) e serializa
  saídas concorrentes do mesmo item (evita "double spend"). É o coração da fatia e o maior risco.
- **Alternativas rejeitadas**: (a) trigger no banco que mantém o saldo — viola "sem migration/lógica
  implícita" e dificulta a mensagem amigável; (b) saldo recalculado on-the-fly sem materialização —
  contraria o modelo 008 (`balance` materializado) e a 009; (c) optimistic locking por versão —
  mais complexo que `FOR UPDATE` para o volume esperado (YAGNI).

## D2 — Não-negatividade do saldo (validação na app + `CHECK` backstop)

- **Decisão**: validar `novoSaldo >= 0` **na aplicação** e devolver `INSUFFICIENT_STOCK` (422) com
  mensagem clara; manter o `CHECK balance >= 0` (008) como **backstop** de defesa em profundidade.
- **Rationale**: a app dá mensagem amigável ("Saldo insuficiente: disponível X, solicitado Y") antes
  de bater no constraint; o `CHECK` cobre qualquer corrida que escape (a transação aborta).
- **Alternativas rejeitadas**: confiar só no `CHECK` (erro cru e feio na UI); só na app (sem
  backstop, frágil sob concorrência).

## D3 — Saldo resultante derivado (window function), sem coluna

- **Decisão**: no histórico, calcular o saldo resultante por
  `SUM(CASE WHEN type = 'purchase' THEN quantity ELSE -quantity END) OVER (ORDER BY movement_date, created_at)`.
  Extrair uma função pura `computeRunningBalance(movements)` (espelho do window) para teste unitário.
- **Rationale**: o modelo 008 **não tem** `balance_after`; derivar evita migration e reescrita
  histórica. O acumulado bate com `epi_stock.balance` porque o saldo só é escrito por esta camada
  (009 mantém `balance` read-only) — invariante documentada (FR-034).
- **Alternativas rejeitadas**: coluna `balance_after` materializada (exige migration + backfill;
  fora do escopo de fluxo); recomputar no cliente (lógica de negócio na borda).

## D4 — Sinal pelo `type`, `quantity` sempre positivo

- **Decisão**: `quantity` é sempre `> 0` (`CHECK` da 008); o efeito no saldo vem do `type`
  (`purchase` `+`; `adjustment`/`discard` `−`). Saída manual aceita apenas `{adjustment, discard}`.
- **Rationale**: alinha ao modelo 008 e evita ambiguidade de sinal. `adjustment` é só decremento
  nesta fatia (ajuste bidirecional é variação futura).

## D5 — Novo código de erro `INSUFFICIENT_STOCK` (→ 422)

- **Decisão**: adicionar `INSUFFICIENT_STOCK: 422` ao `HTTP_BY_CODE` em `src/shared/api/rest.ts`
  (hoje tem `VALIDATION/DUPLICATE/FK_NOT_FOUND/FORBIDDEN/NOT_FOUND/NO_TENANT_CONTEXT/UNAUTHORIZED`).
- **Rationale**: o erro é semanticamente distinto de `VALIDATION` (a entrada é válida; o estado é que
  não permite) e precisa de status próprio mapeável no REST.
- **Alternativas rejeitadas**: reusar `VALIDATION` (perde semântica); `DUPLICATE`/409 (não é
  conflito de unicidade).

## D6 — REST em `/api/v1/epi-stock/[id]/movements`

- **Decisão**: incluir endpoints REST via `restHandler` — **POST** registra (entrada/saída,
  discriminado no corpo) e **GET** retorna o histórico paginado. `[id]` é o `stockId`.
- **Rationale**: alinha ao vertical `epi-stock` da 009 (`/api/v1/epi-stock/[id]/...`) e é testável no
  Postman; `restHandler` já resolve auth/tenant/erro→HTTP e auditoria de escrita sem PII.
- **Alternativas rejeitadas**: só Server Actions (perde a superfície REST que a 009 estabeleceu);
  recurso REST de nível superior `/api/v1/stock-movements` (desalinha do agrupamento por item).

## D7 — Ordenação e exibição de data

- **Decisão**: ordenar `movement_date DESC, created_at DESC`; a UI exibe só a data.
- **Rationale**: `movement_date` é `date` (sem hora) na 008; o `created_at` (timestamp) desempata
  movimentos do mesmo dia de forma estável.

## D8 — Banco de testes: Postgres efêmero

- **Decisão**: testes de Server Action/REST/transação contra **Postgres efêmero** (`INTEGRATION_*`),
  reusando `_helpers/db.ts`/`pgr-seed.ts`/`runIsolationSuite`. Unit puro (`computeRunningBalance`,
  schemas) no default.
- **Rationale**: SQLite não tem RLS, `CHECK`, transação com `FOR UPDATE` nem `current_setting`; o
  backstop, a não-negatividade e a atomicidade só se provam em Postgres real. Constituição §"Fluxo".
- **Restrição de segurança**: jamais apontar `INTEGRATION_*` para o banco de dev (suítes fazem
  `TRUNCATE`).

## D9 — Auditoria

- **Decisão**: `auditedTenantWrite` + `logTenantEvent` (sem PII) nas escritas (entrada/saída); evento
  sugerido `epi.stock_movement.write_rejected` para rejeições. Leitura (histórico) não audita.
- **Rationale**: mesmo padrão da 009 (`epi.epi_stock.write_rejected`).
