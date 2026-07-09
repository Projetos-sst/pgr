import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { GesRiskContext } from "@/shared/domains/pgr/ai-risk-suggestion";

import { withOrg } from "../with-org";
import { ges } from "../schema/ges";
import { gesJobRoles } from "../schema/ges-job-roles";
import { jobRoles } from "../schema/job-roles";
import { aiUsageEvents } from "../schema/ai-usage-events";

/**
 * Contexto **não-PII** do GES para alimentar o prompt: campos descritivos do GES +
 * títulos das funções expostas (com nº de trabalhadores). Escopado por `withOrg`;
 * GES de outra org é invisível pela RLS → retorna `null` (barreira de isolamento
 * antes de qualquer chamada ao LLM). Nunca lê `employees`.
 */
export async function fetchGesRiskContext(
  orgId: string,
  gesId: string,
): Promise<GesRiskContext | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        name: ges.name,
        processDescription: ges.processDescription,
        constructionType: ges.constructionType,
        ceilingHeight: ges.ceilingHeight,
        floor: ges.floor,
        roof: ges.roof,
        lighting: ges.lighting,
        ventilation: ges.ventilation,
        otherCharacteristics: ges.otherCharacteristics,
      })
      .from(ges)
      .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
      .limit(1);
    if (!row) return null;

    const roles = await tx
      .select({ title: jobRoles.title, workerCount: gesJobRoles.workerCount })
      .from(gesJobRoles)
      .innerJoin(
        jobRoles,
        and(eq(jobRoles.id, gesJobRoles.jobRoleId), eq(jobRoles.orgId, orgId)),
      )
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, gesId)));

    return { ...row, roles };
  });
}

/** Conta os usos de IA (`kind`) da organização no mês corrente — base da cota. */
export async function countAiUsageInCurrentMonth(
  orgId: string,
  kind: string,
): Promise<number> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.orgId, orgId),
          eq(aiUsageEvents.kind, kind),
          sql`${aiUsageEvents.createdAt} >= date_trunc('month', now())`,
        ),
      );
    return row.total;
  });
}

/** Registra um uso de IA (append-only) para efeito de cota. */
export async function recordAiUsage(orgId: string, kind: string): Promise<void> {
  await withOrg(orgId, async (tx) => {
    await tx.insert(aiUsageEvents).values({ orgId, kind });
  });
}
