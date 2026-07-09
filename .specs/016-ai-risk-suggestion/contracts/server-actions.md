# Contracts — Server Actions (interno, `ActionResult<T>`)

Ambas as ações são embrulhadas por `officeAction(operation, fn, { audit: true })`, retornam
`ActionResult<T>` (`{ok:true,data}` | `{ok:false,error}`) e passam por `requireOfficeStaff()`
(admite só `owner`/`collaborator`). A regra vive no núcleo compartilhado
`server/pgr/ai-risk-suggestion-core.ts`.

## `suggestRisks(gesId: string): Promise<ActionResult<{ suggestions: SuggestedRisk[] }>>`

Fluxo (`runSuggestRisks`): papel → pertencimento do GES ao tenant → cota → LLM → registra uso.

| Situação                           | `error.code`     | Observação                                               |
| ---------------------------------- | ---------------- | -------------------------------------------------------- |
| Sucesso                            | —                | `{ suggestions }`; registra 1 linha em `ai_usage_events` |
| GES de outra org / inexistente     | `FK_NOT_FOUND`   | **antes** do LLM; não registra uso                       |
| Cota mensal (free) estourada       | `QUOTA_EXCEEDED` | **antes** do LLM                                         |
| Falha/timeout/chave ausente do LLM | `AI_UNAVAILABLE` | não vaza detalhe do provedor                             |
| Papel `client`                     | `FORBIDDEN`      | pelo gate                                                |

- `pro` ignora a cota. Contexto enviado ao LLM = só campos do GES + títulos de função (sem PII).

## `acceptSuggestedRisks(gesId, input): Promise<ActionResult<{ created: number }>>`

`input = { suggestions: SuggestedRisk[] }`. Fluxo (`runAcceptSuggestedRisks`): valida todos os itens →
loop `createRisk` (reuso). `revalidatePath("/risks")`.

| Situação                       | `error.code`      |
| ------------------------------ | ----------------- |
| Sucesso                        | — (`{ created }`) |
| GES de outra org / inexistente | `FK_NOT_FOUND`    |
| Lista vazia / itens inválidos  | `VALIDATION`      |
| Papel `client`                 | `FORBIDDEN`       |

- Riscos criados entram como **rascunho** (sem avaliação/controles), indistinguíveis dos manuais.
