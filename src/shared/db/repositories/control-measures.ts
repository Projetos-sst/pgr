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
import { bridgeControlMeasureToActionPlanTx } from "./control-measure-bridge";

export type ListControlMeasuresParams = PageParams;

/** Ordem fixa da hierarquia NR-01 (estável). A lista tem ≤ 4 itens por risco. */
const LEVEL_ORDER = sql`array_position(
  ARRAY['elimination','collective_protection','administrative','ppe']::text[],
  ${controlMeasures.controlLevel}::text
)`;

/** Colunas de escrita (create e update). **Não** inclui `control_level`/`risk_id` (imutáveis). */
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
    actionDeadline: values.actionDeadline ?? null,
  };
}

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
      // Issue #51: espelha a medida no Plano de Ação, na mesma transação.
      await bridgeControlMeasureToActionPlanTx(tx, orgId, row);
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
      // Não toca `control_level`/`risk_id` (imutáveis — FR-006).
      const [row] = await tx
        .update(controlMeasures)
        .set({ ...toWriteColumns(values), updatedAt: new Date() })
        .where(and(eq(controlMeasures.orgId, orgId), eq(controlMeasures.id, id)))
        .returning();
      if (!row) return null;
      // Issue #51: espelha a medida no Plano de Ação, na mesma transação.
      await bridgeControlMeasureToActionPlanTx(tx, orgId, row);
      return row;
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
