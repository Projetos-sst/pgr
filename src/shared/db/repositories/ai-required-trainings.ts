import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { JobRoleTrainingContext } from "@/shared/domains/pgr/ai-training-suggestion";

import { withOrg } from "../with-org";
import { ges } from "../schema/ges";
import { gesJobRoles } from "../schema/ges-job-roles";
import { jobRoles } from "../schema/job-roles";
import { risks } from "../schema/risks";
import { jobRoleRequiredTrainings, trainingCatalog } from "../schema/trainings";

/**
 * Contexto **não-PII** de uma função para alimentar o prompt de treinamentos: o título do
 * cargo, os GES a que pertence, os riscos desses GES, o catálogo da organização e os
 * vínculos que já existem. Escopado por `withOrg`; função de outra org é invisível pela
 * RLS → `null` (isolamento antes de qualquer chamada ao LLM). Nunca lê `employees`.
 */
export async function fetchJobRoleTrainingContext(
  orgId: string,
  jobRoleId: string,
): Promise<JobRoleTrainingContext | null> {
  return withOrg(orgId, async (tx) => {
    const [role] = await tx
      .select({ title: jobRoles.title })
      .from(jobRoles)
      .where(and(eq(jobRoles.orgId, orgId), eq(jobRoles.id, jobRoleId)))
      .limit(1);
    if (!role) return null;

    // GES aos quais a função está associada — é de lá que vêm os riscos da exposição.
    const gesRows = await tx
      .select({ id: ges.id, name: ges.name })
      .from(gesJobRoles)
      .innerJoin(ges, and(eq(ges.id, gesJobRoles.gesId), eq(ges.orgId, orgId)))
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.jobRoleId, jobRoleId)));

    const gesIds = gesRows.map((g) => g.id);
    const riskRows =
      gesIds.length > 0
        ? await tx
            .select({
              agentType: risks.agentType,
              hazard: risks.hazard,
              description: risks.description,
            })
            .from(risks)
            .where(and(eq(risks.orgId, orgId), inArray(risks.gesId, gesIds)))
        : [];

    const catalog = await tx
      .select({
        id: trainingCatalog.id,
        name: trainingCatalog.name,
        periodicity: trainingCatalog.periodicity,
        isActive: trainingCatalog.isActive,
      })
      .from(trainingCatalog)
      .where(eq(trainingCatalog.orgId, orgId));

    const required = await tx
      .select({ trainingId: jobRoleRequiredTrainings.trainingId })
      .from(jobRoleRequiredTrainings)
      .where(
        and(
          eq(jobRoleRequiredTrainings.orgId, orgId),
          eq(jobRoleRequiredTrainings.jobRoleId, jobRoleId),
        ),
      );

    return {
      jobRoleTitle: role.title,
      gesNames: gesRows.map((g) => g.name),
      risks: riskRows,
      catalog,
      requiredTrainingIds: required.map((r) => r.trainingId),
    };
  });
}
