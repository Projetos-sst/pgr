# Contract — REST `/api/v1/employees/[id]/epi-record` (US5, read-only)

Route Handler via `restHandler(...)`. Auth `requireOfficeStaff()`. Escopado por tenant (`withOrg`).
Reusa `repositories/employee-epi-record.ts` + `domains/pgr/epi-record.ts`.

## `GET /api/v1/employees/[id]/epi-record`
Ficha de EPI (somente leitura) do funcionário `[id]` do tenant.

Query:
- `status` = `pendente | devolvido | todos` (default `todos`) — `pendente` ⇒ `returned_at IS NULL`.
- `from`, `to` = intervalo de `delivery_date` (ambos opcionais, ISO date).
- `page`, `pageSize` (default 20).

Resposta `200` `{ rows, total }`, cada row:
```json
{ "ca": "12345", "epiName": "Luva nitrílica", "size": "M", "quantity": 2,
  "deliveryDate": "2026-07-01", "returnedAt": null,
  "signatureStatus": "signed_manual", "signatureLabel": "Assinada (manual)" }
```
Ordenado por `deliveryDate DESC`.

Erros: `404 NOT_FOUND` funcionário inexistente/cross-tenant; `403 FORBIDDEN` papel `client`.
Funcionário sem entregas → `{ rows: [], total: 0 }` (não erro).

## Observações
- Sem mutação → sem auditoria de escrita.
- A impressão é responsabilidade da UI (CSS `@media print`), não do endpoint.
- Docs em `api-design.md` + pasta/entrada Postman correspondente.
