import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import {
  defaultMeasureStatusForClassification,
  isModeratePlusClassification,
  type ControlMeasureListItem,
  type ControlMeasureWriteValues,
} from "@/shared/domains/pgr/control-measure";
import type { RiskClassification } from "@/shared/domains/pgr/methodology";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import {
  controlMeasures,
  riskAssessments,
  risks,
  type ControlMeasure,
} from "../schema/risks";
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
    status: values.status ?? null,
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

/**
 * Classificação vigente do risco pai (`risk_assessments.result` da avaliação mais recente,
 * mesma ordenação de `getCurrentRiskAssessment`). `null` quando o risco nunca foi avaliado —
 * a regra de status (#42) fica inerte nesse caso, não há nível pra basear o default/bloqueio.
 */
async function getCurrentRiskClassificationTx(
  tx: TenantTransaction,
  orgId: string,
  riskId: string,
): Promise<RiskClassification | null> {
  const [row] = await tx
    .select({ result: riskAssessments.result })
    .from(riskAssessments)
    .where(and(eq(riskAssessments.orgId, orgId), eq(riskAssessments.riskId, riskId)))
    .orderBy(desc(riskAssessments.assessedAt), desc(riskAssessments.createdAt))
    .limit(1);
  return (row?.result as RiskClassification | null) ?? null;
}

/**
 * Regra de status por nível de risco (issue #42), aplicada dentro da mesma transação de
 * create/update (única camada compartilhada por Server Action e REST — ambos chamam este
 * repositório diretamente): risco moderado+ com a medida `applicable` exige `actionResponsible`
 * + `actionDeadline` preenchidos (bloqueio, `VALIDATION`/422); status vazio ganha default pela
 * classificação (`defaultMeasureStatusForClassification`). Não cria plano "placeholder" — a
 * ponte pro Plano de Ação (`bridgeControlMeasureToActionPlanTx`) continua exigindo `actionWhat`/
 * `actionHow` por conta própria (decisão já registrada no lote 028).
 */
function applyMeasureStatusRule(
  values: ControlMeasureWriteValues,
  classification: RiskClassification | null,
): ControlMeasureWriteValues {
  if (
    values.applicable &&
    isModeratePlusClassification(classification) &&
    (!values.actionResponsible || !values.actionDeadline)
  ) {
    throw new ValidationError(
      "Risco moderado ou superior exige responsável e prazo definidos na medida de controle aplicável.",
    );
  }
  return {
    ...values,
    status: values.status ?? defaultMeasureStatusForClassification(classification),
  };
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
        status: controlMeasures.status,
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
      // Issue #42: default de status + bloqueio condicional (moderado+ sem responsável/prazo)
      // pela classificação vigente do risco pai, antes de gravar.
      const classification = await getCurrentRiskClassificationTx(tx, orgId, riskId);
      const ruled = applyMeasureStatusRule(values, classification);
      const [row] = await tx
        .insert(controlMeasures)
        .values({
          orgId,
          riskId,
          controlLevel: ruled.controlLevel,
          ...toWriteColumns(ruled),
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
      // `risk_id` é imutável (FR-006) — busca o risco pai da medida existente para aplicar a
      // regra do #42, sem depender do cliente informar o riskId de novo.
      const [existing] = await tx
        .select({ riskId: controlMeasures.riskId })
        .from(controlMeasures)
        .where(and(eq(controlMeasures.orgId, orgId), eq(controlMeasures.id, id)))
        .limit(1);
      if (!existing) return null;
      const classification = await getCurrentRiskClassificationTx(
        tx,
        orgId,
        existing.riskId,
      );
      const ruled = applyMeasureStatusRule(values, classification);
      // Não toca `control_level`/`risk_id` (imutáveis — FR-006).
      const [row] = await tx
        .update(controlMeasures)
        .set({ ...toWriteColumns(ruled), updatedAt: new Date() })
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
