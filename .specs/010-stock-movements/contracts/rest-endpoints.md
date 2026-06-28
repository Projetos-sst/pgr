# Contrato — REST (`src/app/api/v1/epi-stock/[id]/movements/route.ts`)

**NOVO** Route Handler, via **`restHandler`** (`src/shared/api/rest.ts`) — que resolve o contexto
(auth real ou bypass dev), executa a função, serializa o resultado, mapeia erros conhecidos para HTTP
e audita escritas (POST) sem PII. `[id]` é o **`stockId`**. Requer office staff (`owner`/`collaborator`);
`client` → 403.

## `POST /api/v1/epi-stock/{id}/movements`

Registra um movimento. O corpo discrimina entrada × saída:

- **Entrada**: `{ "kind": "entry", "quantity": int>0, "movementDate": "YYYY-MM-DD", "invoiceNumber"?: string }`
- **Saída**: `{ "kind": "exit", "quantity": int>0, "movementDate": "YYYY-MM-DD", "type": "adjustment" | "discard" }`

`{id}` (path) é o `stockId`. Internamente chama `registerStockEntry`/`registerStockExit`.

| Resultado                                    | Status  | Corpo                                                                                                  |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| Criado                                       | **201** | `{ movement, newBalance }`                                                                             |
| Validação (quantity ≤ 0, type/kind inválido) | 422     | `{ error: { code: "VALIDATION", … } }`                                                                 |
| Saldo insuficiente                           | 422     | `{ error: { code: "INSUFFICIENT_STOCK", message: "Saldo insuficiente: disponível X, solicitado Y" } }` |
| Item inexistente / cross-tenant              | 404     | `{ error: { code: "NOT_FOUND", … } }`                                                                  |
| Papel `client` / sem tenant                  | 403     | `{ error: { code: "FORBIDDEN" \| "NO_TENANT_CONTEXT", … } }`                                           |

## `GET /api/v1/epi-stock/{id}/movements?page=&pageSize=`

Histórico paginado do item.

| Resultado                       | Status  | Corpo                                                                                                                |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| OK                              | **200** | `{ rows: StockMovementRow[], total }` (ordem `movement_date DESC, created_at DESC`; cada linha com `runningBalance`) |
| Item inexistente / cross-tenant | 404     | `{ error: { code: "NOT_FOUND", … } }`                                                                                |
| Papel `client` / sem tenant     | 403     | `{ error: … }`                                                                                                       |

## Pré-requisito de implementação

Adicionar `INSUFFICIENT_STOCK: 422` ao `HTTP_BY_CODE` em `src/shared/api/rest.ts` (hoje não existe).
Sem isso, o erro cairia no fallback 500 em vez de 422.
