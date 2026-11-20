import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  AI_EPI_RISK_FILL_KIND,
  acceptEpiRiskFillInputSchema,
  capEpiCatalog,
  keepCatalogLinks,
  type AcceptEpiRiskFillInput,
  type FilledEpiLink,
} from "@/shared/domains/pgr/ai-epi-risk-fill";
import { requestEpiRiskFill } from "@/shared/integrations/agents";
import * as aiRepo from "@/shared/db/repositories/ai-risk-suggestion";
import { fetchEpiRiskFillContext } from "@/shared/db/repositories/ai-epi-risk-fill";
import { createRiskEpi } from "@/shared/db/repositories/epi-risk";

export type EpiRiskFillResult = { links: FilledEpiLink[] };
export type AcceptEpiRiskFillResult = { created: number; skipped: number };

async function loadContext(tenantId: string, riskId: string) {
  const context = await fetchEpiRiskFillContext(tenantId, riskId);
  if (!context) throw new ReferenceNotFoundError("Risco não encontrado.");
  return context;
}

export async function runEpiRiskFill(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  riskId: string,
): Promise<EpiRiskFillResult> {
  const context = await loadContext(ctx.tenantId, riskId);
  if (context.catalog.length === 0) {
    throw new ValidationError(
      "Nenhum EPI do catálogo disponível para este risco. Cadastre EPIs no catálogo antes de usar a IA pgr-e.",
    );
  }

  const used = await aiRepo.countAiUsageInCurrentMonth(
    ctx.tenantId,
    AI_EPI_RISK_FILL_KIND,
  );
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  const catalog = capEpiCatalog(context.catalog);
  const proposed = await requestEpiRiskFill({ ...context, catalog });
  const links = keepCatalogLinks(proposed, catalog);
  if (links.length > 0) {
    await aiRepo.recordAiUsage(ctx.tenantId, AI_EPI_RISK_FILL_KIND);
  }
  return { links };
}

export async function runAcceptEpiRiskFill(
  ctx: Pick<TenantContext, "tenantId">,
  riskId: string,
  input: AcceptEpiRiskFillInput,
): Promise<AcceptEpiRiskFillResult> {
  const data = acceptEpiRiskFillInputSchema.parse(input);
  const context = await loadContext(ctx.tenantId, riskId);
  const linked = new Set(context.linkedCatalogIds);
  const fresh = data.links.filter((link) => !linked.has(link.catalogId));
  for (const link of fresh) {
    await createRiskEpi(ctx.tenantId, { riskId, ...link });
  }
  return { created: fresh.length, skipped: data.links.length - fresh.length };
}
