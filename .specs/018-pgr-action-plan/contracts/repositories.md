# Contract — Repositório `control-measures`

Arquivo NOVO: `src/shared/db/repositories/control-measures.ts`. Espelha
`repositories/risk-assessments.ts`. `"server-only"`; **único** dono de SQL desta fatia; toda query
via `withOrg`; escritas via `auditedTenantWrite`. **Não** lê avaliação/metodologia; **não** calcula
estado derivado no banco; **não** captura 23505 (a UNIQUE sobe como `DUPLICATE`).

## Imports-chave

```ts
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type {
  ControlMeasureListItem,
  ControlMeasureWriteValues,
} from "@/shared/domains/pgr/control-measure";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";
import { withOrg, type TenantTransaction } from "../with-org";
import { controlMeasures, risks, type ControlMeasure } from "../schema/risks";
import { auditedTenantWrite } from "./audited-write";

export type ListControlMeasuresParams = PageParams; // paginação (escopo = 1 risco, ≤ 4 linhas)
```

## Guard tenant-scopado (idêntico ao de risk-assessments)

```ts
/** Garante que o risco existe DENTRO do tenant (senão FK_NOT_FOUND). */
async function assertRiskInTenant(
  tx: TenantTransaction,
  orgId: string,
  riskId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: risks.id })
    .from(risks)
    .where(and(eq(risks.orgId, orgId), eq(risks.id, riskId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("risk");
}
```

## Ordenação NR-01

```ts
// Ordem fixa da hierarquia NR-01 (estável). A lista tem ≤ 4 itens.
const LEVEL_ORDER = sql`array_position(
  ARRAY['elimination','collective_protection','administrative','ppe']::text[],
  ${controlMeasures.controlLevel}::text
)`;
```

## `toColumns` (escrita)

```ts
// Usado no CREATE (inclui controlLevel) e no UPDATE (SEM controlLevel — imutável, FR-006).
function toWriteColumns(values: ControlMeasureWriteValues) {
  return {
    applicable: values.applicable,
    justification: values.justification ?? null,
    monitoring: values.monitoring ?? null,
    actionWhat: values.actionWhat ?? null,
    actionHow: values.actionHow ?? null,
    actionTracking: values.actionTracking ?? null,
    actionMeasurement: values.actionMeasurement ?? null,
    actionResponsible: values.actionResponsible ?? null,
    actionDeadline: values.actionDeadline ?? null, // "AAAA-MM-DD" | null
  };
}
```

## Assinaturas

| Função | Retorno | Notas |
| --- | --- | --- |
| `listControlMeasures(orgId, riskId, params?)` | `Paginated<ControlMeasureListItem>` | `assertRiskInTenant` → FK_NOT_FOUND; ordena por NR-01; filtra `orgId`+`riskId` |
| `getControlMeasureById(orgId, id)` | `ControlMeasure \| null` | por `id` (sem join); `null` → 404 na Action |
| `createControlMeasure(orgId, riskId, values)` | `ControlMeasure` | `auditedTenantWrite` + `assertRiskInTenant` + INSERT (`controlLevel` vem de `values`); UNIQUE → 23505 → DUPLICATE |
| `updateControlMeasure(orgId, id, values)` | `ControlMeasure \| null` | `auditedTenantWrite`; UPDATE por `(org,id)`; **não** toca `control_level`/`risk_id`; `null` → 404 |
| `deleteControlMeasure(orgId, id)` | `boolean` | `auditedTenantWrite`; DELETE físico RETURNING |

> `createControlMeasure` recebe `values` **com** `controlLevel`; `updateControlMeasure` recebe
> `values` cujo `controlLevel` é **ignorado** na escrita.

## Esboços

```ts
export async function listControlMeasures(
  orgId: string,
  riskId: string,
  params: ListControlMeasuresParams = {},
): Promise<Paginated<ControlMeasureListItem>> {
  const { limit, offset } = resolvePageParams(params);
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const where = and(
      eq(controlMeasures.orgId, orgId),
      eq(controlMeasures.riskId, riskId),
    );
    const rows = await tx
      .select({
        id: controlMeasures.id,
        controlLevel: controlMeasures.controlLevel,
        applicable: controlMeasures.applicable,
        justification: controlMeasures.justification,
        monitoring: controlMeasures.monitoring,
        actionWhat: controlMeasures.actionWhat,
        actionHow: controlMeasures.actionHow,
        actionTracking: controlMeasures.actionTracking,
        actionMeasurement: controlMeasures.actionMeasurement,
        actionResponsible: controlMeasures.actionResponsible,
        actionDeadline: controlMeasures.actionDeadline,
        createdAt: controlMeasures.createdAt,
      })
      .from(controlMeasures)
      .where(where)
      .orderBy(LEVEL_ORDER)
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(controlMeasures)
      .where(where);
    return { rows, total };
  });
}

export async function getControlMeasureById(
  orgId: string,
  id: string,
): Promise<ControlMeasure | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(controlMeasures)
      .where(and(eq(controlMeasures.orgId, orgId), eq(controlMeasures.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createControlMeasure(
  orgId: string,
  riskId: string,
  values: ControlMeasureWriteValues,
): Promise<ControlMeasure> {
  return auditedTenantWrite(orgId, "control_measures.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertRiskInTenant(tx, orgId, riskId);
      const [row] = await tx
        .insert(controlMeasures)
        .values({
          orgId,
          riskId,
          controlLevel: values.controlLevel,
          ...toWriteColumns(values),
        })
        .returning();
      return row;
    }),
  );
}

export async function updateControlMeasure(
  orgId: string,
  id: string,
  values: ControlMeasureWriteValues,
): Promise<ControlMeasure | null> {
  return auditedTenantWrite(orgId, "control_measures.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(controlMeasures)
        .set({ ...toWriteColumns(values), updatedAt: new Date() }) // sem control_level / risk_id
        .where(and(eq(controlMeasures.orgId, orgId), eq(controlMeasures.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteControlMeasure(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "control_measures.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(controlMeasures)
        .where(and(eq(controlMeasures.orgId, orgId), eq(controlMeasures.id, id)))
        .returning({ id: controlMeasures.id });
      return rows.length > 0;
    }),
  );
}
```

## Invariantes

- Toda query filtra explicitamente por `controlMeasures.orgId` (além do RLS backstop).
- `getById` **não** valida `riskId` (a linha carrega `org_id`; `null`/cross-tenant → 404 na Action).
- **Nenhum** `onConflict`/upsert; **nenhum** catch de 23505 (a UNIQUE sobe → `DUPLICATE`/409 via
  `toActionError`).
- `control_level` e `risk_id` só no create; nunca alterados no update.
- Repo **não** lê avaliação/metodologia; **não** calcula estado derivado.
