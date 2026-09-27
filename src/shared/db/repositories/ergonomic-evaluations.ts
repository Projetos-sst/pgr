import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  ErgonomicEvaluationValues,
  PsychosocialAggregate,
} from "@/shared/domains/pgr/ergonomics";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { risks } from "../schema/risks";
import { ges } from "../schema/ges";
import { ergonomicEvaluations, type ErgonomicEvaluation } from "../schema/ergonomics";
import {
  psychosocialCampaigns,
  psychosocialResponses,
  psychosocialRisks,
} from "../schema/psychosocial";
import { auditedTenantWrite } from "./audited-write";

const AUDIT_OP = "pgr.ergonomic_evaluations.write_rejected";

export type ListErgonomicEvaluationsParams = PageParams;

/**
 * Ordem canônica do histórico — **igual** a `compareErgonomicEvaluations` no domínio:
 * `assessed_at` desc, desempate por `created_at` desc e `id` desc. A primeira linha é
 * a vigente. Manter os dois lados em sincronia é o preço de ordenar no banco (evita
 * carregar o histórico inteiro só para escolher uma linha).
 */
const ORDER = [
  desc(ergonomicEvaluations.assessedAt),
  desc(ergonomicEvaluations.createdAt),
  desc(ergonomicEvaluations.id),
] as const;

/** Contexto do risco no tenant (GES + unidade) — base das validações de vínculo. */
type RiskContext = { riskId: string; gesId: string; workUnitId: string };

/**
 * O risco precisa existir no tenant ativo. A FK `risk_id → risks` é checada pelo
 * Postgres ignorando RLS, então este assert sob `withOrg` é a barreira real de
 * isolamento (risco de outro tenant / inexistente → `FK_NOT_FOUND`).
 */
async function assertRiskInTenant(
  tx: TenantTransaction,
  orgId: string,
  riskId: string,
): Promise<RiskContext> {
  const [row] = await tx
    .select({ id: risks.id, gesId: risks.gesId, workUnitId: ges.workUnitId })
    .from(risks)
    .innerJoin(ges, and(eq(ges.id, risks.gesId), eq(ges.orgId, orgId)))
    .where(and(eq(risks.orgId, orgId), eq(risks.id, riskId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("risk");
  return { riskId: row.id, gesId: row.gesId, workUnitId: row.workUnitId };
}

/**
 * Campanha psicossocial vinculável (decisão Q3 = A). Regra de SERVIDOR — a tela só
 * oferece as compatíveis, mas quem chama a API direto passa pelo mesmo crivo:
 *
 * 1. existe **no tenant ativo** (senão `FK_NOT_FOUND`);
 * 2. é do **mesmo contexto** — a unidade da campanha é a unidade do GES do risco;
 * 3. está **`closed`** — o vínculo serve para consolidar um resultado no PGR, e
 *    campanha em rascunho/andamento ainda não tem resultado consolidado.
 *
 * Nada aqui calcula escore: a validação é de vínculo, não de metodologia.
 */
async function assertCampaignLinkable(
  tx: TenantTransaction,
  orgId: string,
  campaignId: string,
  context: RiskContext,
): Promise<void> {
  const [campaign] = await tx
    .select({
      id: psychosocialCampaigns.id,
      workUnitId: psychosocialCampaigns.workUnitId,
      status: psychosocialCampaigns.status,
    })
    .from(psychosocialCampaigns)
    .where(
      and(
        eq(psychosocialCampaigns.orgId, orgId),
        eq(psychosocialCampaigns.id, campaignId),
      ),
    )
    .limit(1);
  if (!campaign) throw new ReferenceNotFoundError("psychosocial_campaign");
  if (campaign.workUnitId !== context.workUnitId) {
    throw new ValidationError(
      "A campanha psicossocial pertence a outra unidade — vincule uma campanha da mesma unidade do GES deste risco.",
    );
  }
  if (campaign.status !== "closed") {
    throw new ValidationError(
      "Só campanha psicossocial encerrada pode ser vinculada como resultado consolidado.",
    );
  }
}

function toColumns(values: ErgonomicEvaluationValues) {
  return {
    assessedAt: values.assessedAt,
    responsible: values.responsible ?? null,
    method: values.method ?? null,
    psychosocialCampaignId: values.psychosocialCampaignId ?? null,
    notes: values.notes ?? null,
    posture: values.posture ?? null,
    postureNotes: values.postureNotes ?? null,
    movements: values.movements ?? null,
    movementsNotes: values.movementsNotes ?? null,
    physicalLoad: values.physicalLoad ?? null,
    physicalLoadNotes: values.physicalLoadNotes ?? null,
    mentalLoad: values.mentalLoad ?? null,
    mentalLoadNotes: values.mentalLoadNotes ?? null,
    workOrganization: values.workOrganization ?? null,
    workOrganizationNotes: values.workOrganizationNotes ?? null,
    physicalEnvironment: values.physicalEnvironment ?? null,
    physicalEnvironmentNotes: values.physicalEnvironmentNotes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listErgonomicEvaluations(
  orgId: string,
  riskId: string,
  params: ListErgonomicEvaluationsParams = {},
): Promise<Paginated<ErgonomicEvaluation>> {
  const { limit, offset } = resolvePageParams(params);
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const where = and(
      eq(ergonomicEvaluations.orgId, orgId),
      eq(ergonomicEvaluations.riskId, riskId),
    );
    const rows = await tx
      .select()
      .from(ergonomicEvaluations)
      .where(where)
      .orderBy(...ORDER)
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(ergonomicEvaluations)
      .where(where);
    return { rows, total };
  });
}

export async function getErgonomicEvaluationById(
  orgId: string,
  id: string,
): Promise<ErgonomicEvaluation | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(ergonomicEvaluations)
      .where(and(eq(ergonomicEvaluations.orgId, orgId), eq(ergonomicEvaluations.id, id)))
      .limit(1);
    return row ?? null;
  });
}

/** Avaliação **vigente** do risco (a mais recente). `null` = nunca avaliado. */
export async function getCurrentErgonomicEvaluation(
  orgId: string,
  riskId: string,
): Promise<ErgonomicEvaluation | null> {
  return withOrg(orgId, async (tx) => {
    await assertRiskInTenant(tx, orgId, riskId);
    const [row] = await tx
      .select()
      .from(ergonomicEvaluations)
      .where(
        and(
          eq(ergonomicEvaluations.orgId, orgId),
          eq(ergonomicEvaluations.riskId, riskId),
        ),
      )
      .orderBy(...ORDER)
      .limit(1);
    return row ?? null;
  });
}

/**
 * Avaliação vigente de **vários** riscos numa query (`DISTINCT ON`) — é o que o
 * consolidado do PGR usa para não cair em N+1.
 */
export async function getCurrentErgonomicEvaluationsByRiskTx(
  tx: TenantTransaction,
  orgId: string,
  riskIds: string[],
): Promise<Map<string, ErgonomicEvaluation>> {
  const byRisk = new Map<string, ErgonomicEvaluation>();
  if (riskIds.length === 0) return byRisk;
  const rows = await tx
    .selectDistinctOn([ergonomicEvaluations.riskId])
    .from(ergonomicEvaluations)
    .where(
      and(
        eq(ergonomicEvaluations.orgId, orgId),
        inArray(ergonomicEvaluations.riskId, riskIds),
      ),
    )
    .orderBy(ergonomicEvaluations.riskId, ...ORDER);
  for (const row of rows) byRisk.set(row.riskId, row);
  return byRisk;
}

/**
 * Agregado das campanhas psicossociais vinculadas (nome, período, nº de respostas e
 * fatores derivados com nível). **Nunca** lê `psychosocial_answers`/`responses` linha a
 * linha: só contagem e fatores já derivados — nenhuma resposta individual sai daqui.
 */
export async function getPsychosocialAggregatesTx(
  tx: TenantTransaction,
  orgId: string,
  campaignIds: string[],
): Promise<Map<string, PsychosocialAggregate>> {
  const byCampaign = new Map<string, PsychosocialAggregate>();
  const unique = [...new Set(campaignIds)];
  if (unique.length === 0) return byCampaign;

  const campaigns = await tx
    .select({
      id: psychosocialCampaigns.id,
      name: psychosocialCampaigns.name,
      status: psychosocialCampaigns.status,
      startsAt: psychosocialCampaigns.startsAt,
      endsAt: psychosocialCampaigns.endsAt,
    })
    .from(psychosocialCampaigns)
    .where(
      and(
        eq(psychosocialCampaigns.orgId, orgId),
        inArray(psychosocialCampaigns.id, unique),
      ),
    );
  if (campaigns.length === 0) return byCampaign;
  const ids = campaigns.map((c) => c.id);

  const counts = await tx
    .select({
      campaignId: psychosocialResponses.campaignId,
      total: sql<number>`count(*)::int`,
    })
    .from(psychosocialResponses)
    .where(
      and(
        eq(psychosocialResponses.orgId, orgId),
        inArray(psychosocialResponses.campaignId, ids),
      ),
    )
    .groupBy(psychosocialResponses.campaignId);
  const countByCampaign = new Map(counts.map((c) => [c.campaignId, c.total]));

  const factorRows = await tx
    .select({
      campaignId: psychosocialRisks.campaignId,
      factor: psychosocialRisks.factor,
      level: psychosocialRisks.level,
    })
    .from(psychosocialRisks)
    .where(
      and(eq(psychosocialRisks.orgId, orgId), inArray(psychosocialRisks.campaignId, ids)),
    )
    .orderBy(desc(psychosocialRisks.level), asc(psychosocialRisks.factor));
  const factorsByCampaign = new Map<string, { factor: string; level: number }[]>();
  for (const row of factorRows) {
    const list = factorsByCampaign.get(row.campaignId) ?? [];
    list.push({ factor: row.factor, level: row.level });
    factorsByCampaign.set(row.campaignId, list);
  }

  for (const c of campaigns) {
    byCampaign.set(c.id, {
      campaignId: c.id,
      name: c.name,
      status: c.status,
      startsAt: c.startsAt ?? null,
      endsAt: c.endsAt ?? null,
      responseCount: countByCampaign.get(c.id) ?? 0,
      factors: factorsByCampaign.get(c.id) ?? [],
    });
  }
  return byCampaign;
}

/** Campanhas psicossociais que o formulário pode oferecer para este risco. */
export async function listLinkableCampaignsForRisk(
  orgId: string,
  riskId: string,
): Promise<
  { id: string; name: string; startsAt: string | null; endsAt: string | null }[]
> {
  return withOrg(orgId, async (tx) => {
    const context = await assertRiskInTenant(tx, orgId, riskId);
    return tx
      .select({
        id: psychosocialCampaigns.id,
        name: psychosocialCampaigns.name,
        startsAt: psychosocialCampaigns.startsAt,
        endsAt: psychosocialCampaigns.endsAt,
      })
      .from(psychosocialCampaigns)
      .where(
        and(
          eq(psychosocialCampaigns.orgId, orgId),
          eq(psychosocialCampaigns.workUnitId, context.workUnitId),
          eq(psychosocialCampaigns.status, "closed"),
        ),
      )
      .orderBy(asc(psychosocialCampaigns.name));
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export async function createErgonomicEvaluation(
  orgId: string,
  riskId: string,
  values: ErgonomicEvaluationValues,
): Promise<ErgonomicEvaluation> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const context = await assertRiskInTenant(tx, orgId, riskId);
      if (values.psychosocialCampaignId) {
        await assertCampaignLinkable(tx, orgId, values.psychosocialCampaignId, context);
      }
      const [row] = await tx
        .insert(ergonomicEvaluations)
        .values({ orgId, riskId, ...toColumns(values) })
        .returning();
      return row;
    }),
  );
}

export async function updateErgonomicEvaluation(
  orgId: string,
  id: string,
  values: ErgonomicEvaluationValues,
): Promise<ErgonomicEvaluation | null> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [existing] = await tx
        .select({ riskId: ergonomicEvaluations.riskId })
        .from(ergonomicEvaluations)
        .where(
          and(eq(ergonomicEvaluations.orgId, orgId), eq(ergonomicEvaluations.id, id)),
        )
        .limit(1);
      if (!existing) return null;
      if (values.psychosocialCampaignId) {
        const context = await assertRiskInTenant(tx, orgId, existing.riskId);
        await assertCampaignLinkable(tx, orgId, values.psychosocialCampaignId, context);
      }
      const [row] = await tx
        .update(ergonomicEvaluations)
        .set({ ...toColumns(values), updatedAt: new Date() })
        .where(
          and(eq(ergonomicEvaluations.orgId, orgId), eq(ergonomicEvaluations.id, id)),
        )
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteErgonomicEvaluation(
  orgId: string,
  id: string,
): Promise<boolean> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(ergonomicEvaluations)
        .where(
          and(eq(ergonomicEvaluations.orgId, orgId), eq(ergonomicEvaluations.id, id)),
        )
        .returning({ id: ergonomicEvaluations.id });
      return rows.length > 0;
    }),
  );
}
