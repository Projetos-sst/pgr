# Contract — Repositórios (Feature 022)

Todos `"server-only"`; **únicos** donos de SQL; toda query via `withOrg` (que **já é uma transação** —
`db/with-org.ts`); escritas via `auditedTenantWrite`. **Nenhum** captura 23505 — a UNIQUE sobe e
`toActionError` a mapeia para `DUPLICATE`.

---

## 1. `repositories/pgr-revisions.ts` — **EDIT**

### `createPgrRevision` — numeração no servidor (D2)

**Antes**: `createPgrRevision(orgId, pgrId, values)` inseria `values.revisionNumber` **vindo do
cliente**. **Depois**: o número é calculado dentro da transação; `values` não o traz mais.

```ts
export async function createPgrRevision(
  orgId: string,
  pgrId: string,
  values: PgrRevisionValues, // { revisedAt, notes } — SEM revisionNumber
): Promise<PgrRevision> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      // 1) trava a linha-pai → serializa criações concorrentes do MESMO pgr.
      //    Espelha lockStockRow (repositories/stock-movements.ts:39-52).
      //    Também é o guard de existência/tenant: sem linha → NotFoundError.
      const [parent] = await tx
        .select({ id: pgr.id })
        .from(pgr)
        .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
        .for("update")
        .limit(1);
      if (!parent) throw new NotFoundError();

      // 2) próximo número (idioma de agregado escalar da casa: sql<number>`…::int`)
      const [{ next }] = await tx
        .select({
          next: sql<number>`coalesce(max(${pgrRevisions.revisionNumber}), 0)::int + 1`,
        })
        .from(pgrRevisions)
        .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)));

      // 3) insert — UNIQUE (org_id, pgr_id, revision_number) é o BACKSTOP
      const [row] = await tx
        .insert(pgrRevisions)
        .values({
          orgId,
          pgrId,
          revisionNumber: next,
          revisedAt: values.revisedAt,
          notes: values.notes ?? null,
        })
        .returning();
      return row;
    }),
  );
}
```

**Contrato de entrada (explícito):**

| Campo            | No input?  | Origem                                          |
| ---------------- | ---------- | ----------------------------------------------- |
| `pgrId`          | sim        | rota / argumento                                |
| `revisedAt`      | sim        | cliente (validado por `z.iso.date()`)           |
| `notes`          | sim (opc.) | cliente                                         |
| `revisionNumber` | **NÃO**    | **calculado no servidor** — o Zod não o declara |
| `orgId`          | **NÃO**    | vem do `withOrg`/sessão, **nunca** do cliente   |

- `AUDIT_OP = "pgr.pgr_revisions.write_rejected"` (mantido).
- **Primeira revisão → 1** (`coalesce(max, 0) + 1`).
- **Retorno** contém o `revisionNumber` **calculado** (o `.returning()` devolve a linha inteira).
- **Concorrência (decisão fechada)**: o `FOR UPDATE` na linha do `pgr` **serializa**; duas criações
  simultâneas para o **mesmo** PGR viram **1 e 2** — **ambas são criadas**, nenhuma é perdida. O lock é
  **por PGR**: PGRs distintos **não se bloqueiam**. **Sem retry** (o lock já basta; nada de loop).
- **`DUPLICATE` (409)**: mantido e testado, mas **apenas como backstop defensivo** da UNIQUE (colisão
  inesperada, ex.: linha legada gravada fora do fluxo). **Não** é o desfecho da concorrência normal.
- **Sem update, sem delete** (revisões seguem append-only).
- O guard de existência/tenant do PGR passa a ser o próprio `SELECT … FOR UPDATE` → `NotFoundError`
  (404) para inexistente/cross-tenant. A Action não precisa mais de um `getPgrById` prévio no create
  (mantém no list).

### `listPgrRevisions` — **sem mudança**

`(orgId, pgrId) => Promise<PgrRevisionListItem[]>`; `orderBy(desc(revisionNumber))`; sem paginação.

### `getLatestRevisionNumber` — **NOVA** (leitura, para o payload)

```ts
export async function getLatestRevisionNumber(
  orgId: string,
  pgrId: string,
): Promise<number | null>; // withOrg; max(revision_number); null se não houver revisão
```

Usada por `repositories/pgr-signature.ts` para preencher `payload.revisionNumber`.

---

## 2. `repositories/pgr-consolidated.ts` — **EDIT** (read-only, 5 → 6 queries)

`getPgrConsolidated(orgId, pgrId): Promise<PgrConsolidated | null>` — assinatura **inalterada**. Tudo
continua dentro de **um** `withOrg`. Mudanças:

| Query                                          | Estado                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — head (`pgr` ⨝ `companies` ⟕ `work_units`)  | **inalterada**                                                                                                                                           |
| 2 — GES (`pgr_ges` ⨝ `ges`)                    | **inalterada** (retorno antecipado quando vazio permanece)                                                                                               |
| 3 — riscos                                     | **+ colunas**: `hazard`, `sources`, `propagation`, `exposureTime`, `possibleInjuries`, `noxiousAgentCode`, `measurementUnit`, `concentrationIntensity`   |
| 4 — avaliação vigente (`DISTINCT ON`, SQL cru) | **+ colunas**: `criterion`, `probability`, `severity`, `uncertainty_degree`, `tolerance_limit`, `assessed_at` (mantém `risk_id`, `risk_level`, `result`) |
| 5 — medidas                                    | **+ colunas**: `justification`, `monitoring`, `actionWhat`, `actionHow`, `actionTracking`, `actionMeasurement`                                           |
| **6 — EPIs por risco (NOVA)**                  | `epi_risk` ⨝ `epi_catalog`, `inArray(epiRisk.riskId, riskIds)`, guardada por `if (riskIds.length > 0)`                                                   |

```ts
// Query 6 — logo após o bloco de medidas, antes da composição em memória.
// Mesma forma de listRiskEpis (repositories/epi-risk.ts:52-70).
const episByRisk = new Map<string, ConsolidatedEpi[]>();
if (riskIds.length > 0) {
  const epiRows = await tx
    .select({
      id: epiRisk.id,
      riskId: epiRisk.riskId,
      catalogId: epiRisk.catalogId,
      name: epiCatalog.name,
      ca: epiCatalog.ca,
      neutralization: epiRisk.neutralization,
    })
    .from(epiRisk)
    .innerJoin(epiCatalog, eq(epiCatalog.id, epiRisk.catalogId))
    .where(and(eq(epiRisk.orgId, orgId), inArray(epiRisk.riskId, riskIds)))
    .orderBy(asc(epiCatalog.name));
  for (const e of epiRows) {
    /* fold em episByRisk */
  }
}
```

- `inArray` e `asc` **já estão importados** (`:3`). Acrescentar
  `import { epiRisk, epiCatalog } from "../schema/epis";`.
- A composição (`for (const r of riskRows)`) lê `epis: episByRisk.get(r.id) ?? []` e
  `assessment: assessmentByRisk.get(r.id) ?? null`.
- **Sem N+1**: 6 queries, fixas. Fallbacks preservados (sem GES / sem riscos / sem avaliação / sem
  medidas / sem EPI → coleções vazias ou `null`, nunca erro).
- ⚠️ `concentration_intensity` é `numeric` → tipar como `string | null`.

---

## 3. `repositories/signature-requests.ts` — **EDIT** (uma função nova)

Tudo o que existe é **reusado sem alteração**: `createRequest`, `countRequestsInCurrentMonth`,
`getRequestStatusById`, `getRequestByToken` (via `withSignatureToken`), `consumeAndCapture`
(UPDATE atômico `WHERE used_at IS NULL` — a guarda de uso único/replay), `signManually`.

### `getLatestRequestByTarget` — **NOVA**

```ts
export type LatestRequestRow = {
  id: string;
  status: SignatureRequest["status"]; // pending | signed | cancelled
  expiresAt: Date;
  signedAt: Date | null;
  signerName: string | null;
};

export async function getLatestRequestByTarget(
  orgId: string,
  targetType: string,
  targetId: string,
): Promise<LatestRequestRow | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        id: signatureRequests.id,
        status: signatureRequests.status,
        expiresAt: signatureRequests.expiresAt,
        signedAt: signatureCaptures.signedAt,
        signerName: signatureCaptures.signerName,
      })
      .from(signatureRequests)
      .leftJoin(signatureCaptures, eq(signatureCaptures.requestId, signatureRequests.id))
      .where(
        and(
          eq(signatureRequests.orgId, orgId),
          eq(signatureRequests.targetType, targetType),
          eq(signatureRequests.targetId, targetId),
        ),
      )
      .orderBy(desc(signatureRequests.createdAt))
      .limit(1);
    return row ?? null;
  });
}
```

Servida pelo índice **já existente** `idx_signature_requests_target (target_type, target_id)`.
**Zero migration.** Leitura → **sem** `auditedTenantWrite`.

**Não** se cria: `cancelRequest` (revogação está fora de escopo — D8), `listRequests`, nem qualquer
outra função.

---

## 4. `repositories/pgr-signature.ts` — **NOVO** (leitura para montar o payload)

```ts
export type PgrSignatureSource = {
  companyName: string;
  workUnitName: string | null;
  responsible: string | null;
  issuedAt: string | null; // date → 'AAAA-MM-DD'
  validUntil: string | null;
};

/** Head do PGR no tenant. null ⇒ inexistente/cross-tenant → NotFoundError na Action. */
export async function getPgrSignatureSource(
  orgId: string,
  pgrId: string,
): Promise<PgrSignatureSource | null>;
```

Uma query (`pgr` ⨝ `companies` ⟕ `work_units`, filtrando `org_id` + `id`, `limit 1`) — a mesma forma da
query 1 da consolidada. É a **única** fonte do payload público: nada de `employees`, nada de GES, nada
de riscos.

---

## Guardas de tenant e erros

| Situação                                       | Erro                                    | HTTP |
| ---------------------------------------------- | --------------------------------------- | ---- |
| PGR inexistente ou de outro tenant             | `NotFoundError` → `NOT_FOUND`           | 404  |
| Colisão de `(org_id, pgr_id, revision_number)` | SQLSTATE 23505 → `DUPLICATE`            | 409  |
| Entrada inválida (Zod)                         | `ZodError` → `VALIDATION`               | 422  |
| Papel `client`                                 | `ForbiddenError` → `FORBIDDEN`          | 403  |
| Cota mensal do plano `free` esgotada           | `QuotaExceededError` → `QUOTA_EXCEEDED` | 402  |

**Nenhum código de erro novo é criado.** Todos já existem em `src/shared/errors/` e em `HTTP_BY_CODE`
(`api/rest.ts:14-30`).
