# Contracts — REST mirror (`/api/v1`, `restHandler`)

Espelho REST das Server Actions, reusando o **mesmo** núcleo compartilhado, schema Zod e `toActionError`
(mapeia códigos de domínio → HTTP). Testável via cURL/Postman. Guardado por `requireOfficeStaff()`
(dev bypass não-prod via `DEV_API_AUTH_BYPASS` + headers `x-dev-*`).

## `POST /api/v1/ges/{id}/risk-suggestions`

Gera sugestões (não persiste). → `runSuggestRisks(id)`.

| Resultado                    | HTTP                                          | Corpo                              |
| ---------------------------- | --------------------------------------------- | ---------------------------------- |
| Sucesso                      | `200`                                         | `{ suggestions: SuggestedRisk[] }` |
| GES cross-tenant/inexistente | `404` (`NOT_FOUND`) ou `422` (`FK_NOT_FOUND`) | erro de domínio                    |
| Cota estourada (free)        | `402` (`QUOTA_EXCEEDED`)                      | —                                  |
| Falha do LLM                 | `502` (`AI_UNAVAILABLE`)                      | mensagem genérica                  |
| Papel `client`               | `403` (`FORBIDDEN`)                           | —                                  |

## `POST /api/v1/ges/{id}/risk-suggestions/accept`

Persiste os selecionados como rascunho. Corpo: `{ suggestions: SuggestedRisk[] }`. →
`runAcceptSuggestedRisks(id, body)`.

| Resultado                    | HTTP                   | Corpo                 |
| ---------------------------- | ---------------------- | --------------------- |
| Criado                       | `201`                  | `{ created: number }` |
| Lista vazia/ inválida        | `422` (`VALIDATION`)   | detalhes Zod          |
| GES cross-tenant/inexistente | `422` (`FK_NOT_FOUND`) | —                     |
| Papel `client`               | `403` (`FORBIDDEN`)    | —                     |

## Mapa de códigos → HTTP (em `src/shared/api/rest.ts`)

`VALIDATION` 422 · `DUPLICATE` 409 · `FK_NOT_FOUND` 422 · `NOT_FOUND` 404 · `FORBIDDEN` 403 ·
`QUOTA_EXCEEDED` 402 · **`AI_UNAVAILABLE` 502 (novo)**.

## Docs & Postman (parte da regra das 4 partes)

- `docs/api/api-design.md`: recurso registrado nas tabelas "Recursos" e "Sumário".
- `docs/api/sst-manager.postman_collection.json`: pasta "Sugestao de riscos (IA)" (suggest + accept),
  reusando as Variables `baseUrl`/`devTenant`/`devRole`/ids.
