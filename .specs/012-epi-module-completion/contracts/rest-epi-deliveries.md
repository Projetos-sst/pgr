# Contract — REST `/api/v1/epi-deliveries` (US2, US3-manual, US4)

Route Handlers via `restHandler(...)` (`src/shared/api/rest.ts`). Auth: `requireOfficeStaff()` (ou dev
bypass fora de produção). Todos escopados por tenant da sessão via `withOrg`. Reusam o **mesmo**
repositório (`repositories/epi-deliveries.ts`), zod (`domains/pgr/epi-deliveries.ts`) e `toActionError`
das Server Actions — nenhuma regra reimplementada.

## `GET /api/v1/epi-deliveries`
Lista entregas do tenant. Query: `?employeeId=&page=&pageSize=&search=`. → `200` `{ rows, total }`
(paginado). Cada row: `{ id, employeeId, employeeName, deliveryDate, signatureStatus, itemCount }`.

## `POST /api/v1/epi-deliveries`
Cria entrega + baixa transacional (R8). Body:
```json
{ "employeeId": "uuid", "deliveryDate": "2026-07-03",
  "items": [{ "stockId": "uuid", "quantity": 2 }] }
```
- `201` `{ id, signatureStatus: "pending", items: [...] }`.
- `422 VALIDATION` body inválido; `422 INSUFFICIENT_STOCK` qualquer item sem saldo (**rollback total**,
  saldo intacto); `404 NOT_FOUND` funcionário/estoque de outro tenant; `403 FORBIDDEN` papel `client`.

## `GET /api/v1/epi-deliveries/[id]`
Detalhe da entrega (itens + status). `200` | `404 NOT_FOUND` (inexistente/cross-tenant).

## `PUT /api/v1/epi-deliveries/[id]`
Atualiza metadados permitidos (ex.: `deliveryDate`) **enquanto pendente**. `200` | `404` | `403`
`FORBIDDEN` se assinada (regra de imutabilidade). _(Escopo mínimo; a spec não exige edição rica.)_

## `DELETE /api/v1/epi-deliveries/[id]`
Exclui entrega **apenas se `pending`**. `204` no sucesso; `403 FORBIDDEN` se `signature_status != pending`
(retorno de saldo só via devolução); `404` cross-tenant. `DELETE` faz `SET NULL` no `delivery_id` dos
movimentos (não estorna saldo).

## `POST /api/v1/epi-deliveries/[id]/sign`  (assinatura manual — US2)
Body: `{}`. Transição `pending → signed_manual` + timestamp. `200` | `409 ALREADY_SIGNED` se já
assinada | `404` cross-tenant | `403` papel `client`.

## `POST /api/v1/epi-deliveries/[id]/return`  (devolução — US4)
Body: `{ "itemId": "uuid" }`. Seta `returned_at` + `applyStockEntry(employee_return, +quantity)` atômico.
`200` `{ itemId, returnedAt, newBalance }` | `409 ALREADY_RETURNED` (saldo intacto) | `404` item de
outro tenant | `403` papel `client`. Independe do status de assinatura.

## Mapeamento de erro (adições em `HTTP_BY_CODE`)
`ALREADY_SIGNED → 409` · `ALREADY_RETURNED → 409` · `TOKEN_INVALID → 404` · `TOKEN_EXPIRED → 410`
(além dos já existentes `INSUFFICIENT_STOCK → 422`, `NOT_FOUND → 404`, `FORBIDDEN → 403`,
`VALIDATION → 422`).

## Docs & Postman (obrigatório)
Registrar em `docs/api/api-design.md` (tabelas "Recursos" e "Sumário") e adicionar pasta
`epi-deliveries` em `docs/api/sst-manager.postman_collection.json`, reusando as Variables
`baseUrl`/`devTenant`/`devRole`.
