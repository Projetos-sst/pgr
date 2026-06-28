# Contracts — Repositórios (011)

`src/shared/db/repositories/epi-deliveries.ts` (`import "server-only"`). Escrita via
`auditedTenantWrite(orgId, evento, fn)` + `withOrg(orgId, tx => …)`. Espelha `stock-movements.ts`/
`epi-stock.ts`. Tipos de domínio em `src/shared/domains/pgr/epi-deliveries.ts`.

## Caminho interno (org-scopado)

### `createDelivery(orgId, input): Promise<{ deliveryId, authToken }>`
- `input`: `{ employeeId, deliveryDate, items: [{ stockId, quantity }] }` (já validado por zod).
- Valida: funcionário pertence ao tenant; cada `stockId` existe no tenant e `balance >= quantity`
  (disponibilidade no momento — **sem** baixar); sem `stockId` duplicado.
- Resolve `catalog_id` de cada `epi_stock.catalog_id`; gera `auth_token` (alta entropia).
- `INSERT epi_deliveries` (`signature_status='pending'`, `auth_token`) + `INSERT epi_delivery_items`.
- **Não baixa estoque** (FR-016). Auditado (`epi.delivery.created`/`write_rejected`).

### `signDeliveryManual(orgId, deliveryId): Promise<DeliveryResult>`
- Carrega a entrega do tenant (`NOT_FOUND`/404 cross-tenant). Se `status != pending` → `ALREADY_SIGNED`/409.
- **Baixa transacional** (helper compartilhado): por item `SELECT … FOR UPDATE epi_stock` → revalida
  `balance - quantity >= 0` (senão `InsufficientStockError`/422 + rollback total) →
  `INSERT stock_movements(employee_delivery, stock_id, delivery_id, quantity, movement_date)` →
  `UPDATE balance`. Depois `UPDATE signature_status='signed_manual'`.
- Retorna `{ delivery, newBalances: [...], lowStockWarnings: [...] }` (aviso de mínima via `deriveStockStatus`).

### `getDelivery(orgId, deliveryId): Promise<DeliveryDetail>`
- Cabeçalho (funcionário, data, status) + itens. `NOT_FOUND`/404 cross-tenant.

### `getDeliveryStatus(orgId, deliveryId): Promise<{ signatureStatus, items? }>`
- Leitura leve para polling do painel "Aguardando confirmação…".

### `listDeliverableStock(orgId, { search, page })` — **reuso** de `listEpiStock(orgId, { withBalanceOnly:true, search })` (009)
- Apenas itens com `balance > 0`; busca por CA/nome; paginação offset.

## Caminho público (sem tenant da sessão)

### `getDeliveryByToken(token): Promise<PublicDeliveryView | null>`
- Busca por `auth_token` **sem** `current_setting` (ver research D3); retorna **dados mínimos**
  (funcionário, itens/quantidades, data, status). `null`/404 se inexistente.
- Deriva `org_id` da linha para o passo de confirmação (não retornado ao cliente).

### `confirmDeliveryByToken(token, method): Promise<DeliveryResult>`
- `method ∈ { qr, link }`. Valida: token existe; `status == pending` (senão `ALREADY_SIGNED`/409);
  não expirado (`created_at + 72h`, senão `TOKEN_EXPIRED`/410).
- Deriva `org_id` → executa a **mesma baixa transacional** via `withOrg(org_id, …)` +
  `UPDATE signature_status = method == 'qr' ? 'signed_qr' : 'signed_link'`. Idempotente.
- Auditado com `org_id` derivado do token (`epi.delivery.signed`/`sign_rejected`), sem PII.

## Helper compartilhado (refator da 010)

### `applyStockExit(tx, { orgId, stockId, quantity, deliveryId? , type })`
- Extraído de `stock-movements.ts`: `SELECT … FOR UPDATE` → valida `>= 0` → `INSERT stock_movements`
  → `UPDATE balance`. Mantém o comportamento atual da 010 (e testes verdes); reutilizado por
  `employee_delivery` com `delivery_id`.
