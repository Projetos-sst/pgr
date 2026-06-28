# Contracts — Server Actions (011)

`src/shared/server/actions/pgr/epi-deliveries.ts`. Todas retornam `ActionResult<T>` (`ok/fail`), nunca
lançam exceção crua. Caminho interno via `officeAction(op, ({ tenantId }) => …, { audit })`
(`requireOfficeStaff()` → `client` 403). Validação zod **antes** da regra; erros mapeados por
`toActionError`. Revalidam as rotas afetadas (`revalidatePath`).

## Internas (gestor)

### `createDeliveryAction(formData): ActionResult<{ deliveryId, authToken }>`
- Parse `deliveryCreateSchema`. `officeAction('epi.delivery.create', …, { audit:true })` →
  `createDelivery(tenantId, input)`. Revalida a página do funcionário / lista de entregas.

### `signDeliveryManualAction(deliveryId): ActionResult<DeliveryResult>`
- `officeAction('epi.delivery.sign_manual', …, { audit:true })` → `signDeliveryManual(tenantId, deliveryId)`.
- Erros: `NOT_FOUND` (404), `ALREADY_SIGNED` (409), `INSUFFICIENT_STOCK` (422). Revalida funcionário +
  estoque (`/epi-stock`) + histórico.

### `getDeliveryStatusAction(deliveryId): ActionResult<{ signatureStatus }>`
- Leitura (sem audit) para polling do painel "Aguardando confirmação…".

### `getDeliveryAction(deliveryId): ActionResult<DeliveryDetail>`
- Leitura para visualização interna da entrega.

### `listDeliverableStockAction({ search, page }): ActionResult<Paginated<StockRow>>`
- Reuso de `listEpiStock` (009) com `withBalanceOnly:true` para o passo 1 (seleção).

## Pública (sem sessão Clerk)

> O caminho público é exposto por **Route Handlers** (não Server Actions org-scopadas), pois não há
> `tenantId` de sessão. Ver `rest-endpoints.md`. A action interna **não** atende o visitante.

## Erros (reuso + novos)

| Código | HTTP | Origem |
| ------ | ---- | ------ |
| `VALIDATION` | 422 | zod |
| `FORBIDDEN` | 403 | `requireOfficeStaff` (client) |
| `NOT_FOUND` | 404 | entrega/token inexistente, cross-tenant |
| `INSUFFICIENT_STOCK` | 422 | baixa sem saldo (já existe da 010) |
| `ALREADY_SIGNED` | 409 | entrega já assinada / token usado (**novo**) |
| `TOKEN_EXPIRED` | 410 | token além de 72h (**novo**) |
| `NO_TENANT_CONTEXT` | 403 | sessão sem tenant (interno) |
