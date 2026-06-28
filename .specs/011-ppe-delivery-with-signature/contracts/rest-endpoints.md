# Contracts — REST Endpoints (011)

Interno via `restHandler(req, ({ tenantId }) => …, { status })` em `src/app/api/v1/...` (org-scopado,
Clerk). Público em `src/app/api/public/...` (sem Clerk; liberado no `src/proxy.ts`). `HTTP_BY_CODE`
mapeia os códigos (inclui os novos `ALREADY_SIGNED→409`, `TOKEN_EXPIRED→410`).

## Interno (`/api/v1`, autenticado)

### `POST /api/v1/epi-deliveries`
- Body: `{ employeeId, deliveryDate, items: [{ stockId, quantity }] }`.
- Cria entrega **pendente** (sem baixa). **201** `{ deliveryId, authToken }`.
- Erros: 422 (validação/saldo na validação de disponibilidade), 404 (funcionário/item), 403.

### `POST /api/v1/epi-deliveries/[id]/sign-manual`
- Assina manual + **baixa transacional**. **200** `{ delivery, newBalances, lowStockWarnings }`.
- Erros: 422 (`INSUFFICIENT_STOCK`), 404, 409 (`ALREADY_SIGNED`), 403.

### `GET /api/v1/epi-deliveries/[id]` e `GET /api/v1/epi-deliveries/[id]/status`
- Visualização / polling do `signature_status`. **200**. 404/403.

## Público (`/api/public`, SEM Clerk)

> Liberar no `src/proxy.ts` `createRouteMatcher`: `"/epi-deliveries/sign/(.*)"` (página) e
> `"/api/public/epi-deliveries/(.*)"` (endpoint). **Não** usar o bypass dev de `/api/v1`. `no-store`.

### `GET /api/public/epi-deliveries/[token]`
- Carrega a entrega por `auth_token` (tenant derivado server-side). **200** com **dados mínimos**
  (funcionário, itens/quantidades, data, status). 404 (inexistente), 410 (`TOKEN_EXPIRED`),
  409 (`ALREADY_SIGNED`, se já assinada). **Nunca** expõe `organization_id` nem dados de outras orgs.

### `POST /api/public/epi-deliveries/[token]/confirm`
- Body: `{ method: "qr" | "link" }`. Deriva `org_id` do token → **baixa transacional** +
  `signature_status` → `signed_qr`/`signed_link`. Idempotente. **200**.
- Erros: 404, 410 (`TOKEN_EXPIRED`), 409 (`ALREADY_SIGNED`), 422 (`INSUFFICIENT_STOCK`).

## Validação de isolamento (obrigatória nos testes)

- Token de **outra org** não retorna dados de terceiros e a confirmação afeta **somente** a entrega
  do token (SC-005). O caminho público é o crítico — suíte dedicada em Postgres efêmero.
