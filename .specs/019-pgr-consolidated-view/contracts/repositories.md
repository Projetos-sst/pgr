# Contract — Repositórios (pgr-ges, pgr-revisions, pgr-consolidated)

Arquivos NOVOS. Todos `"server-only"`; **únicos** donos de SQL; toda query via `withOrg`; escritas
via `auditedTenantWrite`. **Nenhum** captura 23505 (a UNIQUE sobe → `DUPLICATE` via `toActionError`).

## Guards compartilhados

```ts
/** PGR-alvo da rota: inexistente/cross-tenant → NOT_FOUND na Action (repo retorna null/false ou
 *  a Action valida com getPgrById). Para writes ancorados no PGR, valida presença no tenant. */
async function assertPgrInTenant(tx, orgId, pgrId): Promise<void> {
  const [row] = await tx.select({ id: pgr.id }).from(pgr)
    .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId))).limit(1);
  if (!row) throw new ReferenceNotFoundError("pgr"); // mapeado a NOT_FOUND na Action (ver server-actions)
}
/** GES referência de entrada → FK_NOT_FOUND. (mesmo padrão de risks.ts) */
async function assertGesInTenant(tx, orgId, gesId): Promise<void> {
  const [row] = await tx.select({ id: ges.id }).from(ges)
    .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId))).limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
}
```

> **Nota de erro**: para o **PGR** (recurso-alvo), a Action prefere `getPgrById(...) → NotFoundError`
> (404). `assertGesInTenant` → `ReferenceNotFoundError("ges")` (FK_NOT_FOUND/422). Ver
> `server-actions.md`.

## `repositories/pgr-ges.ts`

| Função | Retorno | Notas |
| --- | --- | --- |
| `listPgrGes(orgId, pgrId)` | `PgrGesLinkItem[]` | `pgr_ges` ⨝ `ges`; filtra `org_id`+`pgr_id`; ordena por `ges.name` |
| `addGesToPgr(orgId, pgrId, gesId)` | `PgrGes` | `auditedTenantWrite` + `assertGesInTenant` + INSERT; UNIQUE → 23505 → DUPLICATE |
| `removeGesFromPgr(orgId, pgrId, gesId)` | `boolean` | DELETE por `(org_id, pgr_id, ges_id)` RETURNING; **só o vínculo** |

```ts
export async function listPgrGes(orgId, pgrId): Promise<PgrGesLinkItem[]> {
  return withOrg(orgId, (tx) =>
    tx.select({ id: pgrGes.id, gesId: pgrGes.gesId, gesName: ges.name, createdAt: pgrGes.createdAt })
      .from(pgrGes)
      .innerJoin(ges, and(eq(ges.id, pgrGes.gesId), eq(ges.orgId, orgId)))
      .where(and(eq(pgrGes.orgId, orgId), eq(pgrGes.pgrId, pgrId)))
      .orderBy(asc(ges.name)));
}

export async function addGesToPgr(orgId, pgrId, gesId): Promise<PgrGes> {
  return auditedTenantWrite(orgId, "pgr.pgr_ges.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertGesInTenant(tx, orgId, gesId);
      const [row] = await tx.insert(pgrGes).values({ orgId, pgrId, gesId }).returning();
      return row;
    }));
}

export async function removeGesFromPgr(orgId, pgrId, gesId): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.pgr_ges.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx.delete(pgrGes)
        .where(and(eq(pgrGes.orgId, orgId), eq(pgrGes.pgrId, pgrId), eq(pgrGes.gesId, gesId)))
        .returning({ id: pgrGes.id });
      return rows.length > 0;
    }));
}
```

## `repositories/pgr-revisions.ts`

| Função | Retorno | Notas |
| --- | --- | --- |
| `listPgrRevisions(orgId, pgrId)` | `PgrRevisionListItem[]` | filtra `org_id`+`pgr_id`; ordena `revision_number` desc |
| `createPgrRevision(orgId, pgrId, values)` | `PgrRevision` | `auditedTenantWrite` + INSERT; UNIQUE `revision_number` → 23505 → DUPLICATE; **sem autor** |

```ts
export async function listPgrRevisions(orgId, pgrId): Promise<PgrRevisionListItem[]> {
  return withOrg(orgId, (tx) =>
    tx.select({ id: pgrRevisions.id, revisionNumber: pgrRevisions.revisionNumber,
                revisedAt: pgrRevisions.revisedAt, notes: pgrRevisions.notes,
                createdAt: pgrRevisions.createdAt })
      .from(pgrRevisions)
      .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)))
      .orderBy(desc(pgrRevisions.revisionNumber)));
}

export async function createPgrRevision(orgId, pgrId, values: PgrRevisionValues): Promise<PgrRevision> {
  return auditedTenantWrite(orgId, "pgr.pgr_revisions.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx.insert(pgrRevisions).values({
        orgId, pgrId,
        revisionNumber: values.revisionNumber,
        revisedAt: values.revisedAt,
        notes: values.notes ?? null,
      }).returning();
      return row;
    }));
}
```

> A validação de existência do PGR para revisões acontece na **Action** (via `getPgrById` → 404)
> **antes** de chamar `createPgrRevision`; a FK `pgr_id → pgr` é backstop.

## `repositories/pgr-consolidated.ts` (read-only, sem N+1)

`getPgrConsolidated(orgId, pgrId): Promise<PgrConsolidated | null>` — `null` se o PGR não existe no
tenant (→ 404 na Action). Composição em **≈5 queries** dentro de um `withOrg`:

```ts
export async function getPgrConsolidated(orgId, pgrId): Promise<PgrConsolidated | null> {
  return withOrg(orgId, async (tx) => {
    // 1) PGR + empresa + obra
    const [head] = await tx.select({ /* pgr.*, companyName, workUnitName */ })
      .from(pgr)
      .innerJoin(companies, and(eq(companies.id, pgr.companyId), eq(companies.orgId, orgId)))
      .leftJoin(workUnits, and(eq(workUnits.id, pgr.workUnitId), eq(workUnits.orgId, orgId)))
      .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId))).limit(1);
    if (!head) return null;

    // 2) GES vinculados
    const gesRows = await tx.select({ id: ges.id, name: ges.name })
      .from(pgrGes).innerJoin(ges, and(eq(ges.id, pgrGes.gesId), eq(ges.orgId, orgId)))
      .where(and(eq(pgrGes.orgId, orgId), eq(pgrGes.pgrId, pgrId)))
      .orderBy(asc(ges.name));
    const gesIds = gesRows.map((g) => g.id);
    if (gesIds.length === 0) return { pgr: head, ges: [] };

    // 3) Riscos dos GES (um inArray)
    const riskRows = await tx.select({ id: risks.id, gesId: risks.gesId,
        agentType: risks.agentType, description: risks.description })
      .from(risks).where(and(eq(risks.orgId, orgId), inArray(risks.gesId, gesIds)));
    const riskIds = riskRows.map((r) => r.id);

    // 4) Avaliação vigente por risco (DISTINCT ON — 1 query)
    const currentAssessments = riskIds.length
      ? await tx.execute(sql`select distinct on (risk_id) risk_id, risk_level, result
          from public.risk_assessments
          where org_id = ${orgId} and risk_id in ${...riskIds}
          order by risk_id, assessed_at desc, created_at desc`)
      : [];

    // 5) Medidas por risco (um inArray)
    const measureRows = riskIds.length
      ? await tx.select({ /* control_measures.* projetado */ })
          .from(controlMeasures)
          .where(and(eq(controlMeasures.orgId, orgId), inArray(controlMeasures.riskId, riskIds)))
      : [];

    // composição em memória: agrupa por GES/risco; deriveMeasureState(measure, today);
    // sortConsolidatedRisks(...) por GES.
    return compose(head, gesRows, riskRows, currentAssessments, measureRows, todaySaoPaulo());
  });
}
```

## Invariantes

- Toda query filtra explicitamente por `org_id` (+ RLS backstop).
- `pgr_ges`/`pgr_revisions`: nenhum `onConflict`/upsert; 23505 sobe → DUPLICATE/409.
- Revisões: sem update/delete; sem autor.
- Consolidada: **read-only**, não persiste nada, sem PDF; **sem N+1** (nada de query por risco).
- Consolidada **não** re-deriva histórico: usa `risk_level`/`result` da **avaliação vigente** e
  estado **derivado** das medidas (nunca status persistido/snapshot).
