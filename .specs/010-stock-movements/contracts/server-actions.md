# Contrato — Server Actions (`src/shared/server/actions/pgr/stock-movements.ts`)

**NOVO** módulo. Cada action é envolta por **`officeAction`** (`src/shared/server/office-action.ts`),
que aplica o gate `requireOfficeStaff()` (FR-055), mapeia erros para `ActionResult<T>` via
`toActionError` (FR-053) e audita escritas sem PII (FR-054). Toda action valida a entrada com zod
**antes** da regra (FR-052). `ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code,
message, fields? } }` (`src/shared/server/result.ts`).

## `registerStockEntryAction(input): Promise<ActionResult<{ movement, newBalance }>>`

1. `parse` por `stockEntrySchema` → erro → `fail("VALIDATION", …, fields)`.
2. `requireOfficeStaff()` → `tenantId` (papel `client` → `FORBIDDEN`/403).
3. `repo.registerStockEntry(tenantId, values)`.
4. Sucesso → `ok({ movement, newBalance })`.
5. `NotFoundError` → `NOT_FOUND` (404). Auditoria de escrita (sem PII).

## `registerStockExitAction(input): Promise<ActionResult<{ movement, newBalance }>>`

1. `parse` por `stockExitSchema` (`type ∈ {adjustment, discard}`) → `VALIDATION`.
2. `requireOfficeStaff()` → `tenantId`.
3. `repo.registerStockExit(tenantId, values)`.
4. Sucesso → `ok({ movement, newBalance })`.
5. Erros: `NotFoundError` → `NOT_FOUND` (404); `InsufficientStockError` → `INSUFFICIENT_STOCK` (422,
   mensagem "Saldo insuficiente: disponível X, solicitado Y"). Auditoria de escrita.

## `listStockMovementsAction(stockId, { page?, pageSize? }): Promise<ActionResult<Paginated<StockMovementRow>>>`

1. `requireOfficeStaff()` → `tenantId` (leitura também é restrita à equipe).
2. `repo.listStockMovements(tenantId, stockId, { page, pageSize })`.
3. Sucesso → `ok({ rows, total })`; item de outro tenant → `NOT_FOUND` (404) ou vazio.
4. **Sem** auditoria (é leitura — FR-054).

## Mapa de códigos de erro (contrato → HTTP)

| Código               | HTTP | Quando                                         |
| -------------------- | ---- | ---------------------------------------------- |
| `VALIDATION`         | 422  | zod falhou (quantity ≤ 0, type inválido, etc.) |
| `NOT_FOUND`          | 404  | `stockId` inexistente / cross-tenant           |
| `FORBIDDEN`          | 403  | papel `client` (ou sem office staff)           |
| `INSUFFICIENT_STOCK` | 422  | saída maior que o saldo (novo código)          |
| `NO_TENANT_CONTEXT`  | 403  | sem escritório ativo resolvido                 |

> Regra: actions **nunca** lançam exceção crua para a UI; todo erro vira `ActionResult.error` com um
> **código do contrato** (não status HTTP cru).
