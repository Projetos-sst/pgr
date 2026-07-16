"use server";

import { revalidatePath } from "next/cache";

import { listCompanyOptions } from "@/shared/db/repositories/companies";
import { listWorkUnits } from "@/shared/db/repositories/work-units";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import { PAGE_SIZE_MAX } from "@/shared/pagination";
import {
  campaignInputSchema,
  campaignStatusSchema,
  questionInputSchema,
  type CampaignInput,
  type CampaignListItem,
  type CampaignWithQuestions,
  type QuestionInput,
} from "@/shared/domains/psychosocial/campaigns";
import type {
  CampaignStats,
  ListCampaignsParams,
} from "@/shared/db/repositories/psychosocial-campaigns";
import type { PsychosocialRisk } from "@/shared/db/schema";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/psicossocial/campanhas";

export type Option = { value: string; label: string };

export async function listCampaignOptionsAction(): Promise<
  ActionResult<{ companies: Option[] }>
> {
  return officeAction("psychosocial.company_options", async ({ tenantId }) => {
    const companies = await listCompanyOptions(tenantId);
    return { companies: companies.map((c) => ({ value: c.id, label: c.razaoSocial })) };
  });
}

export async function listWorkUnitOptionsAction(
  companyId: string,
): Promise<ActionResult<Option[]>> {
  return officeAction("psychosocial.work_unit_options", async ({ tenantId }) => {
    const units = await listWorkUnits(tenantId, { companyId, pageSize: PAGE_SIZE_MAX });
    return units.rows.map((w) => ({ value: w.id, label: w.name }));
  });
}

export async function listCampaignsAction(
  params: ListCampaignsParams = {},
): Promise<ActionResult<Paginated<CampaignListItem>>> {
  return officeAction("psychosocial.campaigns.list", ({ tenantId }) =>
    repo.listCampaigns(tenantId, params),
  );
}

export async function getCampaignAction(
  id: string,
): Promise<ActionResult<CampaignWithQuestions>> {
  return officeAction("psychosocial.campaigns.get", async ({ tenantId }) => {
    const row = await repo.getCampaignWithQuestions(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createCampaignAction(
  input: CampaignInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.campaigns.create",
    async ({ tenantId }) => {
      const result = await repo.createCampaign(
        tenantId,
        campaignInputSchema.parse(input),
      );
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function updateCampaignAction(
  id: string,
  input: CampaignInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.campaigns.update",
    async ({ tenantId }) => {
      const ok = await repo.updateCampaign(
        tenantId,
        id,
        campaignInputSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function setCampaignStatusAction(
  id: string,
  status: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.campaigns.status",
    async ({ tenantId }) => {
      const ok = await repo.setCampaignStatus(
        tenantId,
        id,
        campaignStatusSchema.parse(status),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function deleteCampaignAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "psychosocial.campaigns.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteCampaign(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}

// ── Perguntas ───────────────────────────────────────────────────────────────

export async function addQuestionAction(
  campaignId: string,
  input: QuestionInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.questions.add",
    async ({ tenantId }) => {
      const result = await repo.addQuestion(
        tenantId,
        campaignId,
        questionInputSchema.parse(input),
      );
      revalidatePath(`${BASE}/${campaignId}`);
      return result;
    },
    { audit: true },
  );
}

export async function updateQuestionAction(
  campaignId: string,
  questionId: string,
  input: QuestionInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.questions.update",
    async ({ tenantId }) => {
      const ok = await repo.updateQuestion(
        tenantId,
        campaignId,
        questionId,
        questionInputSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(`${BASE}/${campaignId}`);
      return { id: questionId };
    },
    { audit: true },
  );
}

export async function removeQuestionAction(
  campaignId: string,
  questionId: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "psychosocial.questions.remove",
    async ({ tenantId }) => {
      const ok = await repo.removeQuestion(tenantId, campaignId, questionId);
      if (!ok) throw new NotFoundError();
      revalidatePath(`${BASE}/${campaignId}`);
      return { deleted: true as const };
    },
    { audit: true },
  );
}

export async function reorderQuestionAction(
  campaignId: string,
  questionId: string,
  direction: "up" | "down",
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.questions.reorder",
    async ({ tenantId }) => {
      const ok = await repo.reorderQuestion(tenantId, campaignId, questionId, direction);
      if (!ok) throw new NotFoundError();
      revalidatePath(`${BASE}/${campaignId}`);
      return { id: questionId };
    },
    { audit: true },
  );
}

// ── Dashboard / riscos ──────────────────────────────────────────────────────

export async function getCampaignStatsAction(
  id: string,
): Promise<ActionResult<CampaignStats>> {
  return officeAction("psychosocial.campaigns.stats", async ({ tenantId }) => {
    const stats = await repo.getCampaignStats(tenantId, id);
    if (!stats) throw new NotFoundError();
    return stats;
  });
}

export async function deriveRisksAction(
  id: string,
): Promise<ActionResult<PsychosocialRisk[]>> {
  return officeAction(
    "psychosocial.risks.derive",
    ({ tenantId }) => repo.deriveRisksForCampaign(tenantId, id),
    { audit: true },
  );
}

export async function listDerivedRisksAction(
  id: string,
): Promise<ActionResult<PsychosocialRisk[]>> {
  return officeAction("psychosocial.risks.list", ({ tenantId }) =>
    repo.listDerivedRisks(tenantId, id),
  );
}

export async function listCampaignGesOptionsAction(
  id: string,
): Promise<ActionResult<Option[]>> {
  return officeAction("psychosocial.ges_options", async ({ tenantId }) => {
    const options = await repo.listCampaignGesOptions(tenantId, id);
    return options.map((g) => ({ value: g.id, label: g.name }));
  });
}

export async function registerRiskInPgrAction(
  campaignId: string,
  psychoRiskId: string,
  gesId: string,
): Promise<ActionResult<{ riskId: string }>> {
  return officeAction(
    "psychosocial.risks.register",
    async ({ tenantId }) => {
      const result = await repo.registerRiskInPgr(tenantId, psychoRiskId, gesId);
      if (!result) throw new NotFoundError();
      revalidatePath(`${BASE}/${campaignId}`);
      return result;
    },
    { audit: true },
  );
}

export async function concludeCampaignAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.campaigns.conclude",
    async ({ tenantId }) => {
      const ok = await repo.concludeCampaign(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}
