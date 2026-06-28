# Contrato — Repositório de movimentações (`src/shared/db/repositories/stock-movements.ts`)

**NOVO** repositório. Todas as funções são org-scopadas via `withOrg(orgId, async (tx) => …)` (que
abre transação + fixa `app.current_org` para a RLS). `orgId` vem **sempre** da sessão
(`requireTenantContext()` na action), nunca do cliente. Espelha o estilo de `epi-stock.ts` (009).

## `registerStockEntry(orgId, input): Promise<{ movement, newBalance }>`

`input`: `{ stockId, quantity, movementDate, invoiceNumber? }` (já validado por `stockEntrySchema`).

Comportamento (transação atômica):

1. `SELECT … FOR UPDATE` em `epi_stock WHERE id = stockId` (RLS garante tenant). Não encontrado →
   lança `NotFoundError` (→ `NOT_FOUND`/404). Cobre id inexistente e cross-tenant.
2. `novoSaldo = balance + quantity`.
3. `INSERT` em `stock_movements` (`org_id`, `stock_id`, `type='purchase'`, `quantity`, `movement_date`,
   `invoice_number?`).
4. `UPDATE epi_stock SET balance = novoSaldo, updated_at = now()`.
5. Retorna `{ movement: <linha mapeada>, newBalance: novoSaldo }`.

Auditoria: envolto por `auditedTenantWrite(orgId, "epi.stock_movement.write_rejected", …)` no padrão da
009 (evento de fronteira sem PII em rejeição).

## `registerStockExit(orgId, input): Promise<{ movement, newBalance }>`

`input`: `{ stockId, quantity, movementDate, type }` com `type ∈ {adjustment, discard}` (validado por
`stockExitSchema`).

Comportamento (transação atômica):

1. `SELECT … FOR UPDATE` em `epi_stock` (como acima); não encontrado → `NotFoundError`.
2. `novoSaldo = balance - quantity`.
3. **Se `novoSaldo < 0`** → lança `InsufficientStockError` (→ `INSUFFICIENT_STOCK`/422, mensagem
   "Saldo insuficiente: disponível {balance}, solicitado {quantity}") e **rollback** (nada gravado).
4. `INSERT` em `stock_movements` (`type` = `adjustment|discard`, `quantity`, `movement_date`).
5. `UPDATE epi_stock SET balance = novoSaldo`.
6. Retorna `{ movement, newBalance }`.

Backstop: `CHECK balance >= 0` (008) aborta a transação caso a validação da app escape (corrida).

## `listStockMovements(orgId, stockId, { page, pageSize }): Promise<Paginated<StockMovementRow>>`

- Valida que o `epi_stock` (`stockId`) existe no tenant; senão `NotFoundError` (cross-tenant → 404).
- Seleciona movimentos do item, ordem **`movement_date DESC, created_at DESC`**, paginação offset
  (`pageSize` 20, default da 007), retornando `{ rows, total }`.
- **Saldo resultante** por window function:
  `SUM(CASE WHEN type = 'purchase' THEN quantity ELSE -quantity END) OVER (ORDER BY movement_date, created_at)`
  (computado sobre a ordem cronológica ascendente; apresentado conforme a UI).
- `LEFT JOIN epi_deliveries`/`employees` por `delivery_id` para `employeeName` quando
  `type = 'employee_delivery'` (demais tipos → `null`).
- Sem tenant fixado / cross-tenant → conjunto vazio ou `NOT_FOUND` (nunca todos os registros).

## Erros (lançados; mapeados pela action/REST para o contrato)

| Situação                             | Erro lançado                    | Código contrato      | HTTP |
| ------------------------------------ | ------------------------------- | -------------------- | ---- |
| `stockId` inexistente / outro tenant | `NotFoundError`                 | `NOT_FOUND`          | 404  |
| Saída > saldo                        | `InsufficientStockError` (novo) | `INSUFFICIENT_STOCK` | 422  |
| (entrada inválida — antes do repo)   | —                               | `VALIDATION`         | 422  |

> **`InsufficientStockError`** é novo: criar em `src/shared/errors/insufficient-stock-error.ts`
> estendendo `AppError` (`code = "INSUFFICIENT_STOCK"`, `status = 422`), no padrão de
> `not-found-error.ts`. O `toActionError` **já** mapeia qualquer `AppError` (`{ code: error.code, … }`),
> então não há edição em `action-error.ts`; só falta adicionar `INSUFFICIENT_STOCK: 422` ao
> `HTTP_BY_CODE` em `src/shared/api/rest.ts`. (Backstop: o `CHECK balance >= 0` dispara SQLSTATE
> `23514`, que o `toActionError` já mapeia para `VALIDATION`/422.)
