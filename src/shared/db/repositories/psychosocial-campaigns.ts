import "server-only";

import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type {
  CampaignValues,
  CampaignListItem,
  CampaignWithQuestions,
  QuestionValues,
} from "@/shared/domains/psychosocial/campaigns";
import {
  canActivateCampaign,
  toCampaignListItem,
} from "@/shared/domains/psychosocial/campaigns";
import type { SubmitResponseValues } from "@/shared/domains/psychosocial/responses";
import {
  deriveRisks,
  DEFAULT_PSYCHOSOCIAL_THRESHOLD,
  type QuestionStat,
} from "@/shared/domains/psychosocial/derivation";
import { generateToken } from "@/shared/domains/signatures/token";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { todayInSaoPaulo } from "@/shared/dates";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import {
  companies,
  ges,
  psychosocialAnswers,
  psychosocialCampaigns,
  psychosocialQuestions,
  psychosocialResponses,
  psychosocialRisks,
  risks,
  workUnits,
  type PsychosocialCampaign,
  type PsychosocialQuestion,
  type PsychosocialRisk,
} from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { withPsychosocialToken } from "../with-psychosocial-token";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "psychosocial.campaigns.write_rejected";
const countExpr = sql<number>`count(*)::int`;
const questionCountExpr = sql<number>`(
  select count(*)::int from psychosocial_questions q
  where q.campaign_id = "psychosocial_campaigns"."id"
)`;

export type ListCampaignsParams = PageParams & {
  workUnitId?: string;
  status?: string;
};

// ── Campanha ────────────────────────────────────────────────────────────────

export async function listCampaigns(
  orgId: string,
  params: ListCampaignsParams = {},
): Promise<Paginated<CampaignListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(psychosocialCampaigns.orgId, orgId)];
  if (params.workUnitId) {
    filters.push(eq(psychosocialCampaigns.workUnitId, params.workUnitId));
  }
  if (params.status) {
    filters.push(eq(psychosocialCampaigns.status, params.status as "draft"));
  }
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: psychosocialCampaigns.id,
        name: psychosocialCampaigns.name,
        status: psychosocialCampaigns.status,
        startsAt: psychosocialCampaigns.startsAt,
        endsAt: psychosocialCampaigns.endsAt,
        companyName: companies.razaoSocial,
        workUnitName: workUnits.name,
        questionCount: questionCountExpr,
      })
      .from(psychosocialCampaigns)
      .leftJoin(companies, eq(companies.id, psychosocialCampaigns.companyId))
      .leftJoin(workUnits, eq(workUnits.id, psychosocialCampaigns.workUnitId))
      .where(where)
      .orderBy(desc(psychosocialCampaigns.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(psychosocialCampaigns)
      .where(where);
    return { rows: rows.map(toCampaignListItem), total };
  });
}

async function loadQuestions(
  tx: TenantTransaction,
  orgId: string,
  campaignId: string,
): Promise<PsychosocialQuestion[]> {
  return tx
    .select()
    .from(psychosocialQuestions)
    .where(
      and(
        eq(psychosocialQuestions.orgId, orgId),
        eq(psychosocialQuestions.campaignId, campaignId),
      ),
    )
    .orderBy(asc(psychosocialQuestions.position));
}

export async function getCampaignWithQuestions(
  orgId: string,
  id: string,
): Promise<CampaignWithQuestions | null> {
  return withOrg(orgId, async (tx) => {
    const [campaign] = await tx
      .select()
      .from(psychosocialCampaigns)
      .where(
        and(eq(psychosocialCampaigns.orgId, orgId), eq(psychosocialCampaigns.id, id)),
      )
      .limit(1);
    if (!campaign) return null;
    const questions = await loadQuestions(tx, orgId, id);
    return { campaign, questions };
  });
}

async function assertCompanyAndWorkUnit(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  workUnitId: string,
): Promise<void> {
  const [c] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  const [w] = await tx
    .select({ id: workUnits.id })
    .from(workUnits)
    .where(
      and(
        eq(workUnits.orgId, orgId),
        eq(workUnits.id, workUnitId),
        eq(workUnits.companyId, companyId),
      ),
    )
    .limit(1);
  if (!c || !w) throw new ReferenceNotFoundError();
}

export async function createCampaign(
  orgId: string,
  input: CampaignValues,
): Promise<{ id: string }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyAndWorkUnit(tx, orgId, input.companyId, input.workUnitId);
      const [row] = await tx
        .insert(psychosocialCampaigns)
        .values({
          orgId,
          companyId: input.companyId,
          workUnitId: input.workUnitId,
          name: input.name,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          themeColor: input.themeColor ?? null,
          coverPath: input.coverPath ?? null,
          workerDescription: input.workerDescription ?? null,
          publicToken: generateToken(),
        })
        .returning({ id: psychosocialCampaigns.id });
      return { id: row.id };
    }),
  );
}

export async function updateCampaign(
  orgId: string,
  id: string,
  input: CampaignValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyAndWorkUnit(tx, orgId, input.companyId, input.workUnitId);
      const [row] = await tx
        .update(psychosocialCampaigns)
        .set({
          companyId: input.companyId,
          workUnitId: input.workUnitId,
          name: input.name,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          themeColor: input.themeColor ?? null,
          coverPath: input.coverPath ?? null,
          workerDescription: input.workerDescription ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(psychosocialCampaigns.orgId, orgId), eq(psychosocialCampaigns.id, id)),
        )
        .returning({ id: psychosocialCampaigns.id });
      return !!row;
    }),
  );
}

export async function setCampaignStatus(
  orgId: string,
  id: string,
  status: PsychosocialCampaign["status"],
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [campaign] = await tx
        .select({ id: psychosocialCampaigns.id })
        .from(psychosocialCampaigns)
        .where(
          and(eq(psychosocialCampaigns.orgId, orgId), eq(psychosocialCampaigns.id, id)),
        )
        .limit(1);
      if (!campaign) return false;
      if (status === "active") {
        const [{ total }] = await tx
          .select({ total: countExpr })
          .from(psychosocialQuestions)
          .where(
            and(
              eq(psychosocialQuestions.orgId, orgId),
              eq(psychosocialQuestions.campaignId, id),
            ),
          );
        // Campanha sem perguntas não pode ser ativada.
        if (!canActivateCampaign(total)) {
          throw new ValidationError("Campanha sem perguntas não pode ser ativada.");
        }
      }
      await tx
        .update(psychosocialCampaigns)
        .set({ status, updatedAt: new Date() })
        .where(
          and(eq(psychosocialCampaigns.orgId, orgId), eq(psychosocialCampaigns.id, id)),
        );
      return true;
    }),
  );
}

export async function deleteCampaign(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(psychosocialCampaigns)
        .where(
          and(eq(psychosocialCampaigns.orgId, orgId), eq(psychosocialCampaigns.id, id)),
        )
        .returning({ id: psychosocialCampaigns.id });
      return rows.length > 0;
    }),
  );
}

// ── Perguntas (sub-entidade) ────────────────────────────────────────────────

async function assertCampaign(
  tx: TenantTransaction,
  orgId: string,
  campaignId: string,
): Promise<void> {
  const [c] = await tx
    .select({ id: psychosocialCampaigns.id })
    .from(psychosocialCampaigns)
    .where(
      and(
        eq(psychosocialCampaigns.orgId, orgId),
        eq(psychosocialCampaigns.id, campaignId),
      ),
    )
    .limit(1);
  if (!c) throw new NotFoundError();
}

export async function addQuestion(
  orgId: string,
  campaignId: string,
  input: QuestionValues,
): Promise<{ id: string }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCampaign(tx, orgId, campaignId);
      const [{ maxPos }] = await tx
        .select({
          maxPos: sql<number>`coalesce(max(${psychosocialQuestions.position}), -1)::int`,
        })
        .from(psychosocialQuestions)
        .where(
          and(
            eq(psychosocialQuestions.orgId, orgId),
            eq(psychosocialQuestions.campaignId, campaignId),
          ),
        );
      const [row] = await tx
        .insert(psychosocialQuestions)
        .values({
          orgId,
          campaignId,
          text: input.text,
          questionType: input.questionType,
          options: input.options ?? null,
          position: maxPos + 1,
        })
        .returning({ id: psychosocialQuestions.id });
      return { id: row.id };
    }),
  );
}

export async function updateQuestion(
  orgId: string,
  campaignId: string,
  questionId: string,
  input: QuestionValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(psychosocialQuestions)
        .set({
          text: input.text,
          questionType: input.questionType,
          options: input.options ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(psychosocialQuestions.orgId, orgId),
            eq(psychosocialQuestions.campaignId, campaignId),
            eq(psychosocialQuestions.id, questionId),
          ),
        )
        .returning({ id: psychosocialQuestions.id });
      return !!row;
    }),
  );
}

export async function removeQuestion(
  orgId: string,
  campaignId: string,
  questionId: string,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      // Bloqueia remover pergunta com respostas se a campanha está ativa.
      const [campaign] = await tx
        .select({ status: psychosocialCampaigns.status })
        .from(psychosocialCampaigns)
        .where(
          and(
            eq(psychosocialCampaigns.orgId, orgId),
            eq(psychosocialCampaigns.id, campaignId),
          ),
        )
        .limit(1);
      if (!campaign) return false;
      if (campaign.status === "active") {
        const [{ total }] = await tx
          .select({ total: countExpr })
          .from(psychosocialAnswers)
          .where(
            and(
              eq(psychosocialAnswers.orgId, orgId),
              eq(psychosocialAnswers.questionId, questionId),
            ),
          );
        if (total > 0) throw new EntityInUseError();
      }
      const rows = await tx
        .delete(psychosocialQuestions)
        .where(
          and(
            eq(psychosocialQuestions.orgId, orgId),
            eq(psychosocialQuestions.campaignId, campaignId),
            eq(psychosocialQuestions.id, questionId),
          ),
        )
        .returning({ id: psychosocialQuestions.id });
      return rows.length > 0;
    }),
  );
}

export async function reorderQuestion(
  orgId: string,
  campaignId: string,
  questionId: string,
  direction: "up" | "down",
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const ordered = await loadQuestions(tx, orgId, campaignId);
      const idx = ordered.findIndex((q) => q.id === questionId);
      if (idx < 0) return false;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= ordered.length) return true; // borda: no-op
      const a = ordered[idx];
      const b = ordered[swapIdx];
      await tx
        .update(psychosocialQuestions)
        .set({ position: b.position })
        .where(eq(psychosocialQuestions.id, a.id));
      await tx
        .update(psychosocialQuestions)
        .set({ position: a.position })
        .where(eq(psychosocialQuestions.id, b.id));
      return true;
    }),
  );
}

// ── GES para registro do risco (obra da campanha) ───────────────────────────

export async function listCampaignGesOptions(
  orgId: string,
  campaignId: string,
): Promise<{ id: string; name: string }[]> {
  return withOrg(orgId, async (tx) => {
    const [campaign] = await tx
      .select({ workUnitId: psychosocialCampaigns.workUnitId })
      .from(psychosocialCampaigns)
      .where(
        and(
          eq(psychosocialCampaigns.orgId, orgId),
          eq(psychosocialCampaigns.id, campaignId),
        ),
      )
      .limit(1);
    if (!campaign) return [];
    return tx
      .select({ id: ges.id, name: ges.name })
      .from(ges)
      .where(and(eq(ges.orgId, orgId), eq(ges.workUnitId, campaign.workUnitId)))
      .orderBy(asc(ges.name));
  });
}

// ── Rota pública (token) ────────────────────────────────────────────────────

export type PublicCampaignView = {
  orgId: string;
  campaign: {
    id: string;
    name: string;
    themeColor: string | null;
    workerDescription: string | null;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
  };
  questions: {
    id: string;
    text: string;
    questionType: string;
    options: string | null;
    position: number;
  }[];
};

// Estado da rota pública ao resolver (campaignId, token).
export type PublicResolution =
  | { kind: "ok"; view: PublicCampaignView }
  | { kind: "invalid" }
  | { kind: "not_open" };

function isWithinPeriod(startsAt: string | null, endsAt: string | null): boolean {
  const today = todayInSaoPaulo();
  if (startsAt && today < startsAt) return false;
  if (endsAt && today > endsAt) return false;
  return true;
}

export async function resolvePublicCampaign(
  campaignId: string,
  token: string,
): Promise<PublicResolution> {
  // Lê a campanha via policy de capability (sem tenant de ambiente).
  const campaign = await withPsychosocialToken(token, async (tx) => {
    const [row] = await tx
      .select()
      .from(psychosocialCampaigns)
      .where(
        and(
          eq(psychosocialCampaigns.id, campaignId),
          eq(psychosocialCampaigns.publicToken, token),
        ),
      )
      .limit(1);
    return row ?? null;
  });
  if (!campaign) return { kind: "invalid" };
  if (
    campaign.status !== "active" ||
    !isWithinPeriod(campaign.startsAt, campaign.endsAt)
  ) {
    return { kind: "not_open" };
  }
  // Perguntas via tenant da campanha.
  const questions = await withOrg(campaign.orgId, (tx) =>
    loadQuestions(tx, campaign.orgId, campaign.id),
  );
  return {
    kind: "ok",
    view: {
      orgId: campaign.orgId,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        themeColor: campaign.themeColor,
        workerDescription: campaign.workerDescription,
        status: campaign.status,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
      },
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        questionType: q.questionType,
        options: q.options,
        position: q.position,
      })),
    },
  };
}

export async function submitPublicResponse(
  campaignId: string,
  token: string,
  values: SubmitResponseValues,
): Promise<PublicResolution> {
  const resolved = await resolvePublicCampaign(campaignId, token);
  if (resolved.kind !== "ok") return resolved;
  const { orgId, questions } = resolved.view;
  const validQuestionIds = new Set(questions.map((q) => q.id));
  await withOrg(orgId, async (tx) => {
    const [response] = await tx
      .insert(psychosocialResponses)
      .values({ orgId, campaignId })
      .returning({ id: psychosocialResponses.id });
    const rows = values.answers
      .filter((a) => validQuestionIds.has(a.questionId))
      .map((a) => ({
        orgId,
        responseId: response.id,
        questionId: a.questionId,
        valueInt: a.valueInt ?? null,
        valueText: a.valueText ?? null,
      }));
    if (rows.length > 0) await tx.insert(psychosocialAnswers).values(rows);
  });
  return resolved;
}

// ── Dashboard / agregação ───────────────────────────────────────────────────

export type CampaignStats = {
  responseCount: number;
  questions: QuestionStat[];
};

export async function getCampaignStats(
  orgId: string,
  campaignId: string,
): Promise<CampaignStats | null> {
  return withOrg(orgId, async (tx) => {
    const [campaign] = await tx
      .select({ id: psychosocialCampaigns.id })
      .from(psychosocialCampaigns)
      .where(
        and(
          eq(psychosocialCampaigns.orgId, orgId),
          eq(psychosocialCampaigns.id, campaignId),
        ),
      )
      .limit(1);
    if (!campaign) return null;

    const [{ total: responseCount }] = await tx
      .select({ total: countExpr })
      .from(psychosocialResponses)
      .where(
        and(
          eq(psychosocialResponses.orgId, orgId),
          eq(psychosocialResponses.campaignId, campaignId),
        ),
      );

    const qs = await loadQuestions(tx, orgId, campaignId);
    const stats: QuestionStat[] = [];
    for (const q of qs) {
      const [agg] = await tx
        .select({
          avg: sql<number | null>`avg(${psychosocialAnswers.valueInt})`,
          cnt: sql<number>`count(${psychosocialAnswers.valueInt})::int`,
        })
        .from(psychosocialAnswers)
        .where(
          and(
            eq(psychosocialAnswers.orgId, orgId),
            eq(psychosocialAnswers.questionId, q.id),
          ),
        );
      stats.push({
        questionId: q.id,
        text: q.text,
        questionType: q.questionType,
        average: agg.avg == null ? null : Number(agg.avg),
        responseCount: agg.cnt,
      });
    }
    return { responseCount, questions: stats };
  });
}

// ── Derivação de riscos ─────────────────────────────────────────────────────

export async function deriveRisksForCampaign(
  orgId: string,
  campaignId: string,
  threshold: number = DEFAULT_PSYCHOSOCIAL_THRESHOLD,
): Promise<PsychosocialRisk[]> {
  const stats = await getCampaignStats(orgId, campaignId);
  if (!stats) throw new NotFoundError();
  const derived = deriveRisks(stats.questions, threshold);
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      for (const d of derived) {
        // Upsert por (org, campaign, factor) — evita duplicar na re-derivação.
        await tx
          .insert(psychosocialRisks)
          .values({
            orgId,
            campaignId,
            factor: d.factor,
            level: d.level,
            description: d.description,
            sourceQuestionId: d.sourceQuestionId,
          })
          .onConflictDoUpdate({
            target: [
              psychosocialRisks.orgId,
              psychosocialRisks.campaignId,
              psychosocialRisks.factor,
            ],
            set: { level: d.level, description: d.description, updatedAt: new Date() },
          });
      }
      return tx
        .select()
        .from(psychosocialRisks)
        .where(
          and(
            eq(psychosocialRisks.orgId, orgId),
            eq(psychosocialRisks.campaignId, campaignId),
          ),
        )
        .orderBy(desc(psychosocialRisks.level));
    }),
  );
}

export async function listDerivedRisks(
  orgId: string,
  campaignId: string,
): Promise<PsychosocialRisk[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select()
      .from(psychosocialRisks)
      .where(
        and(
          eq(psychosocialRisks.orgId, orgId),
          eq(psychosocialRisks.campaignId, campaignId),
        ),
      )
      .orderBy(desc(psychosocialRisks.level)),
  );
}

// Registra o risco derivado no inventário/PGR (cria `risks` com agente
// psicossocial no GES informado) e vincula. Idempotente: se já registrado, no-op.
export async function registerRiskInPgr(
  orgId: string,
  psychoRiskId: string,
  gesId: string,
): Promise<{ riskId: string } | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [pr] = await tx
        .select()
        .from(psychosocialRisks)
        .where(
          and(eq(psychosocialRisks.orgId, orgId), eq(psychosocialRisks.id, psychoRiskId)),
        )
        .limit(1);
      if (!pr) return null;
      if (pr.riskId) return { riskId: pr.riskId }; // já registrado

      const [g] = await tx
        .select({ id: ges.id })
        .from(ges)
        .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
        .limit(1);
      if (!g) throw new ReferenceNotFoundError();

      const [risk] = await tx
        .insert(risks)
        .values({
          orgId,
          gesId,
          agentType: "psychosocial",
          description: pr.factor,
          sources: pr.description ?? null,
        })
        .returning({ id: risks.id });

      await tx
        .update(psychosocialRisks)
        .set({ riskId: risk.id, updatedAt: new Date() })
        .where(eq(psychosocialRisks.id, psychoRiskId));
      return { riskId: risk.id };
    }),
  );
}

export async function concludeCampaign(orgId: string, id: string): Promise<boolean> {
  return setCampaignStatus(orgId, id, "closed");
}
