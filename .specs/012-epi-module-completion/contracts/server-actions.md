# Contract — Server Actions (US1–US5)

Server Actions via `officeAction(operation, fn, { audit })` (`src/shared/server/office-action.ts`) →
`ActionResult<T>` (`{ ok:true, data } | { ok:false, error }`). Gate `requireOfficeStaff()` embutido.
Espelham os mesmos repositórios/zod dos Route Handlers REST. Ficam em
`src/shared/server/actions/pgr/epi-deliveries.ts` (novo).

## Entrega / assinatura / devolução (`epi-deliveries.ts`)

| Action                     | Assinatura                     | Resultado / erros                                                                                                   |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `createDeliveryAction`     | `(input: CreateDeliveryInput)` | `ActionResult<{ id }>`; `VALIDATION`, `INSUFFICIENT_STOCK`, `NOT_FOUND`, `FORBIDDEN`                                |
| `listDeliveriesAction`     | `(params)`                     | `ActionResult<Paginated<DeliveryRow>>`                                                                              |
| `getDeliveryAction`        | `(id)`                         | `ActionResult<DeliveryDetail>`; `NOT_FOUND`                                                                         |
| `deleteDeliveryAction`     | `(id)`                         | `ActionResult<void>`; `FORBIDDEN` se assinada; `NOT_FOUND`                                                          |
| `signDeliveryManualAction` | `(id)`                         | `ActionResult<void>`; `ALREADY_SIGNED`, `NOT_FOUND`                                                                 |
| `generateSignTokenAction`  | `(id, method)`                 | `ActionResult<{ token, url, qrSvg }>`; gera token 72h com `method` embutido no payload assinado, grava `auth_token` |
| `returnDeliveryItemAction` | `(deliveryId, itemId)`         | `ActionResult<{ returnedAt, newBalance }>`; `ALREADY_RETURNED`, `NOT_FOUND`                                         |

`audit: true` nas mutações (reusa `auditedTenantWrite` no repositório para a baixa/reposição).

## Ficha (US5) — `getEmployeeEpiRecordAction`

`(employeeId, query)` → `ActionResult<Paginated<EpiRecordRow>>`; `NOT_FOUND` cross-tenant. Leitura (a
própria page do funcionário pode consumir o repositório direto; a Action existe para paridade/uso
client-side de filtros).

## Assinatura pública (US3) — **não** é `officeAction`

A confirmação em `/sign/[token]` roda numa Server Action **sem** `requireOfficeStaff` (rota pública):
`submitSignatureAction(token)`. Valida o token (HMAC + TTL), extrai `orgId` e `method` do payload
assinado (nunca do cliente) e executa sob `withOrg(orgId)`. É a única exceção ao gate de office nesta fatia (análoga ao `requireAuth()` da CAEPI,
mas aqui **sem sessão alguma** — a credencial é o token).

## US1 — sem Server Action nova

Wiring puro no `epi-catalog-form.tsx` (troca `TextField` por `CaField`, campos controlados). Reusa
`createEpiCatalogAction`/`updateEpiCatalogAction` existentes e o lookup CAEPI já pronto
(`GET /api/integrations/caepi/[ca]`). Nenhuma alteração de contrato de catálogo.
