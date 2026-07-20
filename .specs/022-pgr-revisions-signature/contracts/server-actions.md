# Contract — Server Actions & núcleo compartilhado (Feature 022)

Regras da casa aplicadas: writes protegidos por `officeAction(op, fn, { audit: true })`; leituras por
`officeAction` sem audit; retorno sempre `ActionResult<T>`; **Zod antes do repositório**; **nenhuma
importação de Drizzle** nas actions; tenant **sempre** de `ctx.tenantId`, **nunca** do cliente;
`revalidatePath` na rota afetada.

---

## 1. Núcleo compartilhado — `server/signatures/create-request-core.ts` (**NOVO**)

Extraído de `actions/signatures.ts:36-69` para que a **regra de cota viva uma única vez** e seja
consumida por 3 chamadores. Espelha `server/pgr/ai-risk-suggestion-core.ts` (fatia 016).

```ts
import "server-only";

export type CreateRequestCoreInput = {
  targetType: SignatureTargetType;
  targetId?: string;
  payload: unknown; // validado aqui pelo payloadSchema do registry
  ttlSeconds?: number;
};

export type CreateRequestCoreResult = {
  requestId: string;
  publicUrl: string; // ⚠️ só existe AQUI — o token cru nunca é persistido (D12)
  qrCodeDataUrl: string;
};

export async function createSignatureRequestCore(
  ctx: TenantContext, // { tenantId, userId, role, plan }
  input: CreateRequestCoreInput,
): Promise<CreateRequestCoreResult>;
```

Passos (idênticos aos de hoje, só realocados):

1. `getPayloadSchema(input.targetType).parse(input.payload)` — validação pelo registry.
2. **Gate de cota (única cópia da regra)**:
   `const n = await repo.countRequestsInCurrentMonth(ctx.tenantId);`
   `if (!isSignatureAvailable(ctx.plan, n)) throw new QuotaExceededError(...)`.
   → `countRequestsInCurrentMonth` **não filtra `target_type`**: PGR e `demo` **compartilham** o
   contador por consequência do reuso. `free` = `FREE_SIGNATURE_MONTHLY_QUOTA` (10); `pro` ilimitado.
3. `generateToken()` → `repo.createRequest(ctx.tenantId, { targetType, targetId, tokenHash: hashToken(raw), payload, expiresAt: computeExpiresAt(ttlSeconds) })`.
4. `buildPublicSignatureUrl(raw)` + `QRCode.toDataURL(url)`.

**O token cru nunca é logado nem persistido** — só o hash (`token_hash`).

---

## 2. `actions/signatures.ts` — **EDIT** (refactor sem mudança de comportamento)

`createSignatureRequest(input)` passa a **delegar** ao core:

```ts
export async function createSignatureRequest(
  input: CreateSignatureRequestInput,
): Promise<ActionResult<CreateSignatureRequestResult>> {
  return officeAction(
    "signatures.create",
    async (ctx) => {
      const data = createSignatureRequestSchema.parse(input);
      const result = await createSignatureRequestCore(ctx, data);
      revalidatePath("/signatures");
      return result;
    },
    { audit: true },
  );
}
```

`getSignatureStatus` e `signManually` — **sem mudança**. Os 9 testes de integração da 010 devem
continuar verdes **sem edição** (é o critério de que o refactor não regrediu).

---

## 3. Adaptador de domínio — `server/pgr/pgr-signature-core.ts` (**NOVO**)

> **Este arquivo é o P1-1 da review.** Sem ele, o Route Handler REST teria de **duplicar** a montagem do
> payload público, o guard de tenant e a derivação de estado — que é exatamente onde um vazamento de
> PII nasceria. Espelha o precedente real `server/pgr/ai-risk-suggestion-core.ts` (e
> `server/platform/{profile,team}-core.ts`).

### Separação de responsabilidades — dois núcleos, não um

| Arquivo                                    | Papel                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `server/signatures/create-request-core.ts` | **Infra genérica**: cota · token · hash · expiração · persistência · URL pública                        |
| `server/pgr/pgr-signature-core.ts`         | **Adaptador do domínio PGR**: valida o PGR · compõe o payload · chama o core genérico · deriva o estado |

O core do PGR **NÃO** duplica cota, token nem persistência — ele **delega**.

```ts
import "server-only";

export type CreatePgrSignatureOptions = { ttlSeconds?: number };

export type CreatePgrSignatureResult = {
  signature: PgrSignatureView; // estado seguro (sem token, sem URL)
  publicUrl: string; // ⚠️ SÓ nesta resposta de criação (D12)
  qrCodeDataUrl: string;
};

export async function createPgrSignature(
  ctx: TenantContext,
  pgrId: string,
  options: CreatePgrSignatureOptions,
): Promise<CreatePgrSignatureResult>;

export async function getPgrSignatureView(
  ctx: TenantContext,
  pgrId: string,
): Promise<PgrSignatureView>;
```

**`createPgrSignature` — responsabilidades (nesta ordem):**

1. **Valida o PGR no tenant**: `getPgrSignatureSource(ctx.tenantId, pgrId)` → `null` ⇒
   `NotFoundError` (**404**), **antes** de qualquer escrita ou consumo de cota.
2. **Carrega apenas a fonte mínima**: `pgr` ⨝ `companies` ⟕ `work_units` — e a **última revisão**
   (`getLatestRevisionNumber`). **Nada de `employees`, GES, riscos ou medidas.**
3. **Compõe `documentTitle` no servidor** (`buildPgrDocumentTitle`) — não existe coluna de título.
4. **Monta o payload público mínimo** (`PgrSignaturePayload`).
5. **Valida o payload com Zod** (`pgrSignaturePayloadSchema`, via registry no core genérico).
6. **Delega ao core genérico**:
   `createSignatureRequestCore(ctx, { targetType: "pgr", targetId: pgrId, payload, ttlSeconds })`
   — cota, token, hash, expiração e persistência **vêm de lá**.
7. **Devolve a `publicUrl` apenas nesta resposta**. Ela **nunca** é reconstruível depois.
8. **Nunca** aceita payload público vindo do cliente.
9. **Nunca** registra o token cru em log nem em metadata de auditoria.

**`getPgrSignatureView` — responsabilidades:**

1. Valida o PGR no tenant (`getPgrById` → `NotFoundError`).
2. `getLatestRequestByTarget(ctx.tenantId, "pgr", pgrId)`.
3. Deriva o estado protegido (reusa `isExpired` de `domains/signatures/token.ts`):

```ts
if (!row)
  return {
    state: "none",
    requestId: null,
    signedAt: null,
    signerName: null,
    expiresAt: null,
  };
const state = isExpired(row.expiresAt, row.status) ? "expired" : row.status;
return {
  state, // pending | signed | expired | cancelled
  requestId: row.id,
  signedAt: row.signedAt?.toISOString() ?? null,
  signerName: row.signerName,
  expiresAt: row.expiresAt.toISOString(),
};
```

4. **Nunca** tenta reconstruir token ou URL. **Nunca** grava nada no `pgr` (que não tem coluna de status).

---

## 4. `actions/pgr/pgr-signature.ts` — **NOVO** (casca fina sobre o core)

```ts
export async function createPgrSignatureRequestAction(input: {
  pgrId: string;
  ttlSeconds?: number;
}): Promise<ActionResult<CreatePgrSignatureResult>> {
  return officeAction(
    "pgr.signature.create",
    async (ctx) => {
      const { pgrId, ...rest } = input;
      const opts = pgrSignatureRequestSchema.parse(rest); // Zod ANTES do core
      const result = await createPgrSignature(ctx, pgrId, opts); // delega
      revalidatePath(`/pgr/${pgrId}`);
      return result;
    },
    { audit: true },
  );
}

export async function getPgrSignatureViewAction(input: {
  pgrId: string;
}): Promise<ActionResult<PgrSignatureView>> {
  return officeAction("pgr.signature.get", (ctx) =>
    getPgrSignatureView(ctx, input.pgrId),
  ); // leitura → SEM audit
}
```

- **A Action não monta payload, não toca Drizzle, não re-implementa cota** — só valida, delega e
  revalida.
- `pgrId` validado (uuid) antes do core.
- Tenant **sempre** de `ctx.tenantId`.
- **Audit só na criação**; o token **não** entra na metadata de auditoria (o `officeAction` emite
  apenas `{ operation, outcome, orgId, userId }`).
- Erros: `NOT_FOUND` (404) · `FORBIDDEN` (403) · `QUOTA_EXCEEDED` (**402**) · `VALIDATION` (422).

---

## 5. `actions/pgr/pgr-revisions.ts` — **EDIT**

`listPgrRevisionsAction(pgrId)` — **sem mudança**.

`createPgrRevisionAction(pgrId, input)` — o input **perde `revisionNumber`**:

```ts
export async function createPgrRevisionAction(
  pgrId: string,
  input: PgrRevisionInput, // { revisedAt, notes } — revisionNumber é PROIBIDO
): Promise<ActionResult<PgrRevision>> {
  return officeAction(
    "pgr.pgr_revisions.create",
    async ({ tenantId }) => {
      const values = pgrRevisionInputSchema.parse(input); // .strict() → revisionNumber ⇒ 422
      const row = await repo.createPgrRevision(tenantId, pgrId, values); // repo calcula o número
      revalidatePath(`/pgr/${pgrId}`);
      return row;
    },
    { audit: true },
  );
}
```

**`revisionNumber` no input → `VALIDATION` (422)**, não "ignorado" (FR-005). O schema é `.strict()`
justamente para que um cliente desatualizado **falhe visivelmente** em vez de acreditar que controla o
número.

O `getPgrById` prévio pode sair do create: o `SELECT … FOR UPDATE` no repositório **já é** o guard de
existência/tenant (`NotFoundError`). Mantido no `list`.

> **Auditoria**: `{ audit: true }` emite `{ operation, outcome, orgId, userId }` — mas isso é **uma
> linha de log em stdout**, não uma tabela. Não constitui "autor da revisão" e a UI **não o exibe**.

---

## 6. `actions/public-signatures.ts` — **REUSADA SEM MUDANÇA (somente ler)**

`resolvePublicSignature(token)` e `submitPublicSignature(token, input)` já fazem tudo o que a US5
precisa, e **não têm gate de office staff nem de plano** (correto — a rota pública nunca checa plano):

- Tenant derivado **do token** (policy de capability, `withSignatureToken`) — nunca do cliente.
- Estados públicos: `signable | invalid | expired | used`. Token inexistente **e** inválido → ambos
  `invalid` (**anti-enumeração**).
- Uso único/replay: `consumeAndCapture` faz `UPDATE … WHERE used_at IS NULL` (atômico) → segundo envio
  devolve `ALREADY_USED`, **sem escrita**.
- `cancelled` colapsa em `used` no resolvedor público — **comportamento real, mantido de propósito**.
- Zod: `publicSignatureSchema` valida `signerName` (≤120) e `imageDataUrl` (PNG data-URL, ≤350 000
  chars) **antes** de qualquer escrita.

**Nada aqui é alterado.** O que faltava para essa rota funcionar não era código de action — era o
`proxy.ts` (D9).

---

## 7. Resumo — matriz de actions

| Action                            | Arquivo                           | Delega a                  | Gate               | Audit   | Erros                                                    |
| --------------------------------- | --------------------------------- | ------------------------- | ------------------ | ------- | -------------------------------------------------------- |
| `listPgrRevisionsAction`          | `actions/pgr/pgr-revisions.ts`    | repo                      | office staff       | não     | `NOT_FOUND`, `FORBIDDEN`                                 |
| `createPgrRevisionAction`         | `actions/pgr/pgr-revisions.ts`    | repo (calcula o nº)       | office staff       | **sim** | `NOT_FOUND`, `DUPLICATE`¹, `VALIDATION`², `FORBIDDEN`    |
| `getPgrConsolidatedAction`        | `actions/pgr/pgr-consolidated.ts` | repo                      | office staff       | não     | `NOT_FOUND`, `FORBIDDEN`                                 |
| `createPgrSignatureRequestAction` | `actions/pgr/pgr-signature.ts`    | **`pgr-signature-core`**  | office staff       | **sim** | `NOT_FOUND`, `QUOTA_EXCEEDED`, `VALIDATION`, `FORBIDDEN` |
| `getPgrSignatureViewAction`       | `actions/pgr/pgr-signature.ts`    | **`pgr-signature-core`**  | office staff       | não     | `NOT_FOUND`, `FORBIDDEN`                                 |
| `createSignatureRequest`          | `actions/signatures.ts`           | **`create-request-core`** | office staff       | **sim** | `QUOTA_EXCEEDED`, `VALIDATION`, `FORBIDDEN`              |
| `resolvePublicSignature`          | `actions/public-signatures.ts`    | repo (via token)          | **nenhum** (token) | não     | — (devolve estado, nunca lança)                          |
| `submitPublicSignature`           | `actions/public-signatures.ts`    | repo (via token)          | **nenhum** (token) | não     | `NOT_FOUND`, `EXPIRED`, `ALREADY_USED`, `VALIDATION`     |

¹ `DUPLICATE` **apenas como backstop defensivo** da UNIQUE — nunca da concorrência normal.
² `VALIDATION` (422) inclui o caso **`revisionNumber` enviado pelo cliente** (schema `.strict()`).

**As duas rotas REST do PGR (`POST`/`GET /api/v1/pgr/{id}/signature`) chamam o MESMO
`pgr-signature-core`** — o guard, o payload, a cota e a derivação vivem **uma única vez**.
