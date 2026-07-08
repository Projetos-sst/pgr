# Contract — Repositório `risk-assessments`

Arquivo NOVO: `src/shared/db/repositories/risk-assessments.ts`. Espelha `repositories/risks.ts`.
`"server-only"`; **único** dono de SQL desta fatia; toda query via `withOrg`; escritas via
`auditedTenantWrite`. **Não** lê/escreve `risk_methodology` (a metodologia é lida na camada de
Action/handler e os derivados chegam prontos). Recebe `riskLevel`/`result` já computados.

## Tipos

```ts
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type {
  RiskAssessmentListItem,
  RiskAssessmentWriteValues,
} from "@/shared/domains/pgr/risk-assessment";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { type PageParams, type Paginated, resolvePageParams } from "@/shared/pagination";
import { withOrg, type TenantTransaction } from "../with-org";
import { riskAssessments, type RiskAssessment } from "../schema/risks";
import { risks } from "../schema/risks";
import { auditedTenantWrite } from "./audited-write";

export type ListRiskAssessmentsParams = PageParams; // paginação apenas (escopo = 1 risco)
```

## Guard tenant-scopado

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

## Assinaturas

| Função                                                                                   | Retorno                              | Erros/Notas                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `listRiskAssessments(orgId, riskId, params?)`                                            | `Paginated<RiskAssessmentListItem>`  | `assertRiskInTenant` → `FK_NOT_FOUND`; ordena `assessedAt desc`, `createdAt desc` |
| `getRiskAssessmentById(orgId, id)`                                                       | `RiskAssessment \| null`             | por `id` (sem join); `null` → 404 na Action   |
| `getCurrentRiskAssessment(orgId, riskId)`                                                | `RiskAssessment \| null`             | `assertRiskInTenant`; última por ordenação; `null` se risco sem avaliações (não é erro) |
| `createRiskAssessment(orgId, riskId, values: RiskAssessmentWriteValues)`                 | `RiskAssessment`                     | `auditedTenantWrite` + `assertRiskInTenant` + INSERT |
| `updateRiskAssessment(orgId, id, values: RiskAssessmentWriteValues)`                     | `RiskAssessment \| null`             | `auditedTenantWrite`; UPDATE por `(org,id)`; **não** toca `risk_id`; `null` → 404 |
| `deleteRiskAssessment(orgId, id)`                                                        | `boolean`                            | `auditedTenantWrite`; DELETE físico RETURNING |

## Esboços

```ts
function toColumns(values: RiskAssessmentWriteValues) {
  return {
    criterion: values.criterion,
    probability: values.probability,
    severity: values.severity,
    riskLevel: values.riskLevel,
    uncertaintyDegree: values.uncertaintyDegree,
    toleranceLimit: values.toleranceLimit ?? null,
    result: values.result,
    assessedAt: values.assessedAt, // "YYYY-MM-DD"
  };
}

const ORDER = [desc(riskAssessments.assessedAt), desc(riskAssessments.createdAt)] as const;

export async function listRiskAssessments(
  orgId: string,
  riskId: string,
  params: ListRiskAssessmentsParams = {},
): Promise<Paginated<RiskAssessmentListItem>> {
  const { limit, offset } = resolvePageParams(params);
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const where = and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.riskId, riskId));
    const rows = await tx
      .select({
        id: riskAssessments.id,
        criterion: riskAssessments.criterion,
        probability: riskAssessments.probability,
        severity: riskAssessments.severity,
        riskLevel: riskAssessments.riskLevel,
        uncertaintyDegree: riskAssessments.uncertaintyDegree,
        toleranceLimit: riskAssessments.toleranceLimit,
        result: riskAssessments.result,
        assessedAt: riskAssessments.assessedAt,
        createdAt: riskAssessments.createdAt,
      })
      .from(riskAssessments)
      .where(where)
      .orderBy(...ORDER)
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(riskAssessments)
      .where(where);
    return { rows, total };
  });
}

export async function getCurrentRiskAssessment(
  orgId: string,
  riskId: string,
): Promise<RiskAssessment | null> {
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const [row] = await tx
      .select()
      .from(riskAssessments)
      .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.riskId, riskId)))
      .orderBy(...ORDER)
      .limit(1);
    return row ?? null;
  });
}

export async function createRiskAssessment(
  orgId: string,
  riskId: string,
  values: RiskAssessmentWriteValues,
): Promise<RiskAssessment> {
  return auditedTenantWrite(orgId, "risk_assessments.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertRiskInTenant(tx, orgId, riskId);
      const [row] = await tx
        .insert(riskAssessments)
        .values({ orgId, riskId, ...toColumns(values) })
        .returning();
      return row;
    }),
  );
}

export async function updateRiskAssessment(
  orgId: string,
  id: string,
  values: RiskAssessmentWriteValues,
): Promise<RiskAssessment | null> {
  return auditedTenantWrite(orgId, "risk_assessments.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(riskAssessments)
        .set({ ...toColumns(values), updatedAt: new Date() })
        .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteRiskAssessment(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "risk_assessments.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(riskAssessments)
        .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.id, id)))
        .returning({ id: riskAssessments.id });
      return rows.length > 0;
    }),
  );
}
```

## Invariantes

- Toda query filtra explicitamente por `riskAssessments.orgId` (além do RLS backstop).
- `getById` **não** valida `riskId` (a linha carrega `org_id`; `null`/cross-tenant → 404 na Action).
- Nenhum `onConflict`/upsert; nenhum tratamento de `DUPLICATE`/409.
- `risk_id` só é definido no create; nunca alterado no update.
- Repo **não** importa metodologia; `riskLevel`/`result` chegam em `RiskAssessmentWriteValues`.
