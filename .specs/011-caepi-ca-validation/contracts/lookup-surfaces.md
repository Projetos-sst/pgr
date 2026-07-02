# Contract — Surfaces de consulta (Server Action, REST, hook, campo CA)

Gate único nas duas surfaces: **sessão** (`requireAuth()` — Clarifications 2026-07-02; sem
tenant, sem papel, sem dev-bypass). Lógica única no serviço `lookup.ts`; as surfaces só orquestram.

## Serviço compartilhado — `src/shared/integrations/caepi/lookup.ts`

```ts
/** ca já validado/normalizado. Nunca lança por "não encontrado" — devolve o estado. */
export async function lookupCaRecord(ca: string): Promise<CaLookupResult>;
```

- Fluxo: `getByCa(ca)` → sem registro → `{ status: "not_found", ca, baseUnsynced: baseEmpty }`;
  com registro → `validateCa(record, todayInSaoPaulo())` → mapeia para `valid`/`expired` com
  `manufacturer`/`norm`/`validUntil`/`equipmentName?` (coalesce de nulos — data-model §3).
- 100% local (Inv-1). Consumido pela Server Action e pelo Route Handler — **uma** implementação.

## Server Action — `src/shared/server/actions/epi/lookup-ca.ts`

```ts
"use server";
export async function lookupCa(ca: string): Promise<ActionResult<CaLookupResult>>;
```

| Cenário                         | Retorno                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| Sessão ok + formato válido      | `ok(CaLookupResult)` — inclusive `not_found` (é payload, não erro) |
| Formato inválido (`!isValidCa`) | `fail("VALIDATION", "CA inválido.")` — sem tocar a base            |
| Sem sessão                      | `fail("UNAUTHORIZED", …)` via `toActionError`                      |
| Erro inesperado                 | logado e **relançado** (padrão `officeAction`)                     |

- Guarda inline `requireAuth()` (research R8 — sem wrapper genérico novo; `officeAction` não serve
  pois exige staff/tenant).

## REST — `GET /api/integrations/caepi/[ca]`

Arquivo: `src/app/api/integrations/caepi/[ca]/route.ts` (molde `cep/[cep]`), reusando
`ensureSession()`/`invalidFormat()` de `_lib/respond.ts`.

| Cenário                         | Status | Corpo (`ActionResult`)                                                        |
| ------------------------------- | ------ | ----------------------------------------------------------------------------- |
| CA vigente                      | 200    | `ok({ status: "valid", ca, manufacturer, norm, validUntil, equipmentName? })` |
| CA vencido/cancelado            | 200    | `ok({ status: "expired", … })`                                                |
| CA inexistente                  | 200    | `ok({ status: "not_found", ca })`                                             |
| Base vazia (nunca sincronizada) | 200    | `ok({ status: "not_found", ca, baseUnsynced: true })`                         |
| Formato inválido                | 422    | `fail("VALIDATION", "CA inválido.")`                                          |
| Sem sessão                      | 401    | `fail("UNAUTHORIZED", "Sessão necessária.")`                                  |

- **Divergência consciente do molde CEP/CNPJ** (Clarifications): os 3 estados são payload 200 —
  `not_found` é resultado informativo de negócio (aviso na UI), não falha; isso permite ao hook
  reusar o `useLookup` (que só entrega dado em `response.ok && body.ok`). Não usar
  `respondWithProviderResult` (não há provider externo aqui — a base local é a fonte).
- **Cache-Control**: sem cache agressivo (`no-store`): a resposta depende de "hoje" (um CA que
  vence hoje muda de estado amanhã) — diferente de CEP/CNPJ.
- Registrar em `docs/api/api-design.md` (seção "Integrações externas") + folder na coleção Postman
  única (molde CEP/CNPJ; reusar variável `baseUrl`).

## Hook — `src/shared/integrations/caepi/client/use-caepi-validation.ts`

```ts
export type CaepiValidationStatus =
  | "idle"
  | "loading"
  | "valid"
  | "expired"
  | "not_found"
  | "error";

export function useCaepiValidation(opts: {
  onFound: (data: Extract<CaLookupResult, { status: "valid" | "expired" }>) => void;
}): {
  status: CaepiValidationStatus;
  data?: CaLookupResult;
  lookup: (ca: string) => void;
};
```

- **Wrapper do `useLookup`** (research R7): `isValid: isValidCa`, `buildUrl:
/api/integrations/caepi/${normalizeCa(ca)}`. Herda: dispara só com formato válido, aborta a
  requisição anterior (AbortController), nunca lança (falha → `error` silencioso).
- Deriva `status` do payload quando o fetch dá certo; chama `onFound` **também** em `expired`
  (autofill acontece nos dois — FR-061), nunca em `not_found`.

## Campo — `src/shared/integrations/caepi/client/ca-field.tsx`

- Client Component controlado: input CA + gatilho no blur (e/ou botão lupa) → `lookup(ca)`.
- Feedback por estado (FR-061): `valid` → badge verde; `expired` → aviso "CA vencido" (distinto de
  inexistente); `not_found` → "CA não encontrado" ou "base CAEPI ainda não sincronizada"
  (`baseUnsynced`); `error` → silencioso; `loading` → indicador discreto.
- Autofill via `onFound` (fabricante/norma/validade escritos **no formulário** — cópia por valor;
  nada gravado na base pública). Campos sempre editáveis; salvar **nunca** depende do estado
  (FR-062/063). Plugável no form de EPI da #18 (não incluído nesta fatia).
