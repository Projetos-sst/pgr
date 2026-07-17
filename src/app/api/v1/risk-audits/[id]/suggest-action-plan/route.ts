import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/risk-audits";
import { runSuggestActionPlan } from "@/shared/server/safety/action-plan-suggestion-core";
import type { ActionPlanOriginType } from "@/shared/domains/safety/action-plan-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Sugestão 5W2H por IA para a origem da auditoria. Retorna **apenas** os campos validados
 * (nunca prompt/resposta bruta/dados da origem). IA opcional: `402 QUOTA_EXCEEDED` /
 * `502 AI_UNAVAILABLE`; falha nunca persiste plano nem altera a auditoria.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => {
    const { id } = await params;
    const audit = await repo.getRiskAudit(ctx.tenantId, id);
    if (!audit) throw new NotFoundError();
    return runSuggestActionPlan(
      ctx,
      audit.origin.type as ActionPlanOriginType,
      audit.audit.originId,
    );
  });
}
