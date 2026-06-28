# Data Model — Movimentações de estoque e histórico (`stock_movements`)

Fase 1 do `/speckit-plan`. **A fonte da verdade do schema é a 008** (`src/shared/db/schema/epis.ts`,
migrations `0007`/`0008`). Esta fatia **não altera o modelo** (zero migration) — apenas **lê/escreve**
as tabelas abaixo e define DTOs/inputs/derivações de aplicação.

## Entidades herdadas (008) — referência

### `stock_movements` (escrita + leitura nesta fatia)

| Coluna                      | Tipo                                                  | Notas                                                    |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `id`                        | `uuid` PK                                             | `defaultRandom()`                                        |
| `org_id`                    | `text` NOT NULL → `orgs.id` (cascade)                 | tenant; RLS `stock_movements_isolation`                  |
| `stock_id`                  | `uuid` NOT NULL → `epi_stock.id` (cascade)            | item de estoque                                          |
| `delivery_id`               | `uuid` → `epi_deliveries.id` (**set null**, nullable) | só para `employee_delivery` (#19, fora)                  |
| `type`                      | enum `stock_movement_type`                            | `purchase \| employee_delivery \| adjustment \| discard` |
| `quantity`                  | `integer` NOT NULL                                    | **`CHECK quantity > 0`** — sempre positivo               |
| `movement_date`             | `date` NOT NULL `defaultNow()`                        | **é DATE (sem hora)**                                    |
| `invoice_number`            | `text` (nullable)                                     | NF — só na entrada (compra)                              |
| `created_at` / `updated_at` | `timestamptz` NOT NULL                                | desempate de ordenação intra-dia                         |

Índices: `org_id`, `stock_id`, `delivery_id`. RLS: `stock_movements_isolation` (`app_runtime`,
`org_id = current_setting('app.current_org', true)`).

### `epi_stock` (esta fatia ESCREVE `balance`; a 009 só lê)

| Coluna                      | Tipo                                         | Notas                                          |
| --------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `id`                        | `uuid` PK                                    |                                                |
| `org_id`                    | `text` NOT NULL → `orgs.id` (cascade)        | RLS `epi_stock_isolation`                      |
| `catalog_id`                | `uuid` NOT NULL → `epi_catalog.id` (cascade) | `UNIQUE(org_id, catalog_id)`                   |
| `balance`                   | `integer` NOT NULL `default 0`               | **`CHECK balance >= 0`** — saldo materializado |
| `min_quantity`              | `integer` NOT NULL `default 0`               | `CHECK min_quantity >= 0`                      |
| `created_at` / `updated_at` | `timestamptz` NOT NULL                       |                                                |

### `epi_deliveries` (leitura indireta — nome do funcionário no histórico)

Relevante apenas para `JOIN` opcional: `stock_movements.delivery_id → epi_deliveries.id →
epi_deliveries.employee_id → employees`. Movimentos `employee_delivery` são gerados por #19 (fora do
escopo); nesta fatia a coluna "Funcionário" do histórico normalmente fica vazia.

## Tipos/derivações de aplicação (NOVOS — sem coluna no banco)

### Inputs (zod) — `src/shared/domains/pgr/stock-movements.ts`

- **`stockEntrySchema`**: `{ stockId: uuid, quantity: int().positive(), movementDate: date,
invoiceNumber?: string().trim().optional() }`.
- **`stockExitSchema`**: `{ stockId: uuid, quantity: int().positive(), movementDate: date,
type: enum(['adjustment','discard']) }`.

### DTOs de leitura

- **`StockMovementRow`** (linha do histórico): `{ id, type, typeLabel (pt-BR), quantity, signedQuantity,
movementDate, invoiceNumber?, runningBalance, employeeName? }`.
- **`Paginated<StockMovementRow>`**: `{ rows, total }` (padrão de paginação offset da 007).
- **Retorno de escrita**: `{ movement: StockMovementRow, newBalance: number }`.

### Funções puras / mapeadores

- **`computeRunningBalance(movements)`**: dado os movimentos em ordem cronológica **ascendente**,
  retorna o saldo acumulado por linha (`+quantity` para `purchase`, `-quantity` para os demais).
  Espelha a window function da query (D3). **Testável isoladamente** (unit).
- **`signedQuantity(type, quantity)`**: `purchase → +quantity`; `adjustment`/`discard`/
  `employee_delivery → -quantity`.
- **`stockMovementTypeLabel(type)`**: `purchase=Compra`, `adjustment=Ajuste`, `discard=Descarte`,
  `employee_delivery=Entrega`.

## Regras de derivação e invariantes

- **Saldo resultante derivado** (não há `balance_after`): por window function na query e por
  `computeRunningBalance` na app. (FR-030)
- **Invariante de consistência**: `Σ signedQuantity(todos os movimentos do item) == epi_stock.balance`
  — vale porque `balance` só é escrito por esta camada. (FR-034)
- **Ordenação canônica**: `movement_date DESC, created_at DESC` na exibição; o cálculo do acumulado
  usa a ordem **ascendente** (cronológica) e é apresentado conforme a UI. (FR-031)

## Transição de estado do saldo (por movimento)

```
estado: epi_stock.balance = B
  entrada (purchase, q>0):   B → B + q
  saída (adjustment|discard, q>0):
        se B - q >= 0:        B → B - q
        senão:                ERRO INSUFFICIENT_STOCK (422), estado inalterado (rollback)
```
