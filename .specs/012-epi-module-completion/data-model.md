# Data Model — Fase 02 (módulo EPI)

Fonte de verdade: `src/shared/db/schema/epis.ts` (fatia 008, já em `develop`). Esta leva **altera o
modelo só na US4** (migration `0010`); as demais histórias operam sobre o modelo existente. Abaixo: o
que já existe (contexto), a única mudança de esquema, e os **read models** derivados (ficha).

## Entidades existentes (contexto — não alteradas, exceto onde marcado)

### `epi_catalog` (não alterada)
Cadastro do EPI. Campos relevantes à US1: `ca`, `caValidUntil (date)`, `manufacturer`, `norm`
(autopreenchidos a partir do CAEPI). RLS por tenant. **US1 é wiring de UI — nenhum campo muda.**

### `epi_stock` (não alterada)
Saldo materializado por item: `balance integer NOT NULL DEFAULT 0` com `CHECK balance >= 0`; único por
`(org_id, catalog_id)`. Alterado transacionalmente por `applyStockExit`/`applyStockEntry`.

### `stock_movements` (enum estendido em 0010)
Movimento tipado; `quantity > 0` sempre positivo; `type` define o efeito no saldo; `delivery_id`
(nullable, `SET NULL`) liga o movimento à entrega. **0010 adiciona o valor `employee_return` ao enum
`stock_movement_type`.**

- Enum atual: `purchase | employee_delivery | adjustment | discard`.
- Enum após 0010: `… | employee_return` (entrada que repõe saldo na devolução).

### `epi_deliveries` (não alterada)
Entrega a um funcionário. `signature_status` (enum `pending | signed_qr | signed_link | signed_manual`,
default `pending`); `auth_token text` único quando presente (índice parcial `uq_epi_deliveries_auth_token
WHERE auth_token is not null`). **US2/US3 usam estes campos inline — sem coluna nova.**

- Assinatura registra o **timestamp** via `updated_at` na transição de status (ou coluna dedicada só se
  o negócio exigir; por YAGNI, `updated_at` no momento da assinatura + `signature_status` bastam para
  "quem/quando/como").

### `epi_delivery_items` (COLUNA NOVA em 0010)
Item da entrega: `delivery_id` (`CASCADE`), `catalog_id` (`RESTRICT`), `quantity > 0`. **0010 adiciona
`returned_at timestamptz` (nullable)** — `NULL` = pendente; preenchido = devolvido.

### `epi_risk` (fora de escopo — #78, Fase 03)
Não tocada.

## Mudança de esquema — Migration `0010_epi_delivery_return`

Emitida via `npm run db:generate` + edição manual (SQL custom, padrão `0005`); aplicada por conexão
direta unpooled (owner). Dois statements separados por `--> statement-breakpoint` (ver research R5):

```sql
-- 0010_epi_delivery_return.sql
-- Forward-only no enum: Postgres não remove valor de enum; rollback só derruba a coluna.
ALTER TYPE "stock_movement_type" ADD VALUE IF NOT EXISTS 'employee_return';
--> statement-breakpoint
ALTER TABLE "epi_delivery_items" ADD COLUMN "returned_at" timestamptz;
```

- **Sem** GRANT/RLS novos: a coluna herda a policy `epi_delivery_items_isolation` e o `app_runtime` já
  tem os GRANTs da tabela (fatia 008). `set_updated_at_epi_delivery_items` já existe.
- Reversão documentada: `ALTER TABLE epi_delivery_items DROP COLUMN returned_at;` (o valor de enum
  permanece — forward-only).

Reflexo no schema Drizzle (`epis.ts`):
- `stockMovementType` pgEnum: acrescentar `"employee_return"`.
- `epiDeliveryItems`: acrescentar `returnedAt: timestamp("returned_at", { withTimezone: true })`
  (nullable) + índice opcional para filtro de pendentes se necessário (avaliar `idx` por
  `(org_id, returned_at)` — só se o plano de acesso justificar; por ora o filtro é por `delivery`).

## Regras de dados e transições

### Entrega (US2)
- Estado inicial: `epi_deliveries.signature_status = 'pending'`.
- Baixa por item na **confirmação** (transação única): `applyStockExit` valida `balance - quantity >= 0`
  → senão `InsufficientStockError` (`INSUFFICIENT_STOCK`, 422) e rollback total.
- Exclusão: permitida só enquanto `signature_status = 'pending'`; assinada → `FORBIDDEN` (guard em
  `deleteDelivery`). `DELETE` da entrega faz `SET NULL` no `stock_movements.delivery_id` (não estorna
  saldo — retorno de saldo só por devolução).

### Assinatura (US2 manual + US3 pública) — máquina de estados
```
pending ──signManual──▶ signed_manual
pending ──signByToken(QR)──▶ signed_qr
pending ──signByToken(link)──▶ signed_link
signed_* ──(qualquer assinatura)──▶ ALREADY_SIGNED (409)   # idempotência: só transiciona de pending
```
- Transição só a partir de `pending`; caso contrário `AlreadySignedError`.
- Token (US3): válido ⇔ HMAC confere **e** `now - iat <= 72h` **e** `auth_token` bate com o registro
  **e** entrega ainda `pending`. Falhas: assinatura HMAC inválida/inexistente → `TokenInvalidError`
  (404); `now - iat > 72h` → `TokenExpiredError` (410); entrega já assinada → mensagem de negócio (não
  500).

### Devolução (US4)
```
item.returned_at IS NULL ──returnItem──▶ returned_at = now()  +  applyStockEntry(employee_return, +quantity)
item.returned_at NOT NULL ──returnItem──▶ ALREADY_RETURNED (409)   # saldo intacto
```
- Transação única: valida item no tenant e `returned_at IS NULL` → seta `returned_at` → repõe saldo do
  `epi_stock` do `catalog_id` do item (`FOR UPDATE`). Independe do `signature_status`.
- Item cross-tenant → `NOT_FOUND` (RLS + filtro por org).

## Read model — Ficha de EPI do funcionário (US5, sem tabela nova)

`getEmployeeEpiRecord(orgId, employeeId, { status, from, to, page })` → `Paginated<EpiRecordRow>`.

Join escopado por tenant (`withOrg`):
`epi_deliveries × epi_delivery_items × epi_catalog`, filtrado por `employee_id` (do tenant).

Colunas por linha (`EpiRecordRow`):
| Campo | Origem |
| --- | --- |
| `ca` | `epi_catalog.ca` |
| `epiName` | `epi_catalog.name` |
| `size` | `epi_catalog.size` |
| `quantity` | `epi_delivery_items.quantity` |
| `deliveryDate` | `epi_deliveries.delivery_date` |
| `returnedAt` | `epi_delivery_items.returned_at` (0010; `null` = pendente) |
| `signatureStatus` | `epi_deliveries.signature_status` (+ label) |

- Ordenação: `delivery_date DESC` (mais recente primeiro). Paginação offset (`{rows,total}`,
  `resolvePageParams`, pageSize padrão 20).
- Filtro `status`: `pendente` ⇒ `returned_at IS NULL`; `devolvido` ⇒ `returned_at IS NOT NULL`; `todos` ⇒
  sem filtro. Filtro de período: `delivery_date BETWEEN from AND to` (ambos opcionais).
- Funcionário cross-tenant → `NOT_FOUND`; funcionário sem entregas → `{ rows: [], total: 0 }`.

## Validação (Zod — `domains/pgr/epi-deliveries.ts` e `epi-record.ts`)

- `createDeliverySchema`: `{ employeeId: uuid, deliveryDate: date, items: array(min 1) of { stockId:
  uuid, quantity: int > 0 } }`.
- `signManualSchema`: `{}` (id vem da rota); apenas exige papel office.
- `returnSchema`: `{ itemId: uuid }` (por item, total).
- `signByTokenSchema` (rota pública): `{ token: string, method: 'qr' | 'link' }` (+ imagem opcional, ver
  research R4 — não persistida por ora).
- `epiRecordQuerySchema`: `{ status?: 'pendente'|'devolvido'|'todos', from?: date, to?: date, page?,
  pageSize? }`.

Toda entrada validada **antes** de tocar o banco (Princípio V). Constraints do banco (`CHECK`, FKs,
unique de token, `balance >= 0`) permanecem como fonte de verdade.
