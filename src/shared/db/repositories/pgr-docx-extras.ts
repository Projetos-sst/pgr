import "server-only";

import { and, asc, eq, inArray, or, isNull } from "drizzle-orm";

import type { PgrDocxExtras } from "@/shared/domains/pgr/pgr-docx/from-consolidated";

import { withOrg } from "../with-org";
import { companies } from "../schema/companies";
import { ges } from "../schema/ges";
import { gesJobRoles } from "../schema/ges-job-roles";
import { jobRoles } from "../schema/job-roles";
import { pgr, pgrGes, pgrRevisions } from "../schema/pgr";
import { jobRoleRequiredTrainings, trainingCatalog } from "../schema/trainings";
import { machineInstallations } from "../schema/machine-installations";

/**
 * O que o PGR em DOCX precisa ALÉM da visão consolidada (`getPgrConsolidated`): a
 * caracterização de cada GES, as funções por GES (quadro de funções), as revisões, a
 * matriz de treinamentos obrigatórios por função e o telefone/logo da empresa. Tudo já
 * persistido — nada é inventado. Queries em lote numa transação `withOrg` (sem N+1).
 * `null` se o PGR não existe no tenant.
 */
export async function getPgrDocxExtras(
  orgId: string,
  pgrId: string,
): Promise<PgrDocxExtras | null> {
  return withOrg(orgId, async (tx) => {
    const [head] = await tx
      .select({
        phone: companies.phone,
        logoPath: companies.logoPath,
        companyId: pgr.companyId,
        workUnitId: pgr.workUnitId,
      })
      .from(pgr)
      .innerJoin(
        companies,
        and(eq(companies.id, pgr.companyId), eq(companies.orgId, orgId)),
      )
      .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
      .limit(1);
    if (!head) return null;

    const gesRows = await tx
      .select({
        id: ges.id,
        processDescription: ges.processDescription,
        constructionType: ges.constructionType,
        ceilingHeight: ges.ceilingHeight,
        floor: ges.floor,
        roof: ges.roof,
        lighting: ges.lighting,
        ventilation: ges.ventilation,
        otherCharacteristics: ges.otherCharacteristics,
      })
      .from(pgrGes)
      .innerJoin(ges, and(eq(ges.id, pgrGes.gesId), eq(ges.orgId, orgId)))
      .where(and(eq(pgrGes.orgId, orgId), eq(pgrGes.pgrId, pgrId)));
    const gesIds = gesRows.map((row) => row.id);

    const roleRows =
      gesIds.length === 0
        ? []
        : await tx
            .select({
              gesId: gesJobRoles.gesId,
              jobRoleId: jobRoles.id,
              title: jobRoles.title,
              description: jobRoles.description,
              workSchedule: gesJobRoles.workSchedule,
              roleWorkSchedule: jobRoles.workSchedule,
              workerCount: gesJobRoles.workerCount,
            })
            .from(gesJobRoles)
            .innerJoin(
              jobRoles,
              and(eq(jobRoles.id, gesJobRoles.jobRoleId), eq(jobRoles.orgId, orgId)),
            )
            .where(and(eq(gesJobRoles.orgId, orgId), inArray(gesJobRoles.gesId, gesIds)))
            .orderBy(asc(jobRoles.title));
    const jobRoleIds = [...new Set(roleRows.map((row) => row.jobRoleId))];

    const trainingRows =
      jobRoleIds.length === 0
        ? []
        : await tx
            .select({
              jobRoleId: jobRoleRequiredTrainings.jobRoleId,
              trainingId: trainingCatalog.id,
              number: trainingCatalog.number,
              name: trainingCatalog.name,
              referenceNorm: trainingCatalog.referenceNorm,
            })
            .from(jobRoleRequiredTrainings)
            .innerJoin(
              trainingCatalog,
              and(
                eq(trainingCatalog.id, jobRoleRequiredTrainings.trainingId),
                eq(trainingCatalog.orgId, orgId),
                eq(trainingCatalog.isActive, true),
              ),
            )
            .where(
              and(
                eq(jobRoleRequiredTrainings.orgId, orgId),
                inArray(jobRoleRequiredTrainings.jobRoleId, jobRoleIds),
              ),
            )
            .orderBy(asc(trainingCatalog.number));

    const revisions = await tx
      .select({
        revisionNumber: pgrRevisions.revisionNumber,
        revisedAt: pgrRevisions.revisedAt,
        notes: pgrRevisions.notes,
      })
      .from(pgrRevisions)
      .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)))
      .orderBy(asc(pgrRevisions.revisionNumber));

    const machineRows = await tx
      .select()
      .from(machineInstallations)
      .where(
        and(
          eq(machineInstallations.orgId, orgId),
          eq(machineInstallations.companyId, head.companyId),
          eq(machineInstallations.active, true),
          or(
            head.workUnitId
              ? and(
                  eq(machineInstallations.workUnitId, head.workUnitId),
                  isNull(machineInstallations.gesId),
                )
              : undefined,
            gesIds.length ? inArray(machineInstallations.gesId, gesIds) : undefined,
          ),
        ),
      )
      .orderBy(asc(machineInstallations.catalogName), asc(machineInstallations.id));
    return {
      machines: head.workUnitId || gesIds.length ? machineRows : [],
      company: { phone: head.phone, logoPath: head.logoPath },
      revisions,
      ges: Object.fromEntries(
        gesRows.map(({ id, ...characterization }) => [
          id,
          {
            ...characterization,
            jobRoles: roleRows
              .filter((role) => role.gesId === id)
              .map((role) => ({
                id: role.jobRoleId,
                title: role.title,
                description: role.description,
                workSchedule: role.workSchedule ?? role.roleWorkSchedule,
                workerCount: role.workerCount,
              })),
          },
        ]),
      ),
      requiredTrainings: trainingRows.map((row) => ({
        jobRoleId: row.jobRoleId,
        trainingId: row.trainingId,
        label: row.referenceNorm?.trim() || row.name,
      })),
    };
  });
}
