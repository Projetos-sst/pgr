import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { MedicalRiskSnapshot } from "@/shared/domains/medicine/risk-sources";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams } from "@/shared/pagination";
import { withOrg } from "../with-org";
import { companies } from "../schema/companies";
import {
  medicalRiskSources,
  medicalRiskEntries,
  medicalRiskEvents,
} from "../schema/medical-risk-sources";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";

export type InternalMedicalSource = {
  pgrId: string;
  revisionNumber: number | null;
  updatedAt: string;
  groupCount: number;
  risks: MedicalRiskSnapshot[];
};

/** A single SQL statement gives a coherent MVCC snapshot (no interleaved reads). */
export async function getInternalMedicalSource(
  orgId: string,
  companyId: string,
  pgrId: string,
): Promise<InternalMedicalSource | null> {
  return (await getInternalMedicalSources(orgId, companyId, [pgrId]))[0] ?? null;
}

export async function getInternalMedicalSources(
  orgId: string,
  companyId: string,
  pgrIds: string[],
): Promise<InternalMedicalSource[]> {
  if (pgrIds.length === 0) return [];
  return withOrg(orgId, async (tx) => {
    const rows = await tx.execute(sql`
      select p.id as "pgrId", p.updated_at::text as "updatedAt",
        (select max(revision_number) from public.pgr_revisions rev where rev.pgr_id=p.id and rev.org_id=${orgId}) as "revisionNumber",
        (select count(*)::int from public.pgr_ges pg where pg.pgr_id=p.id and pg.org_id=${orgId}) as "groupCount",
        coalesce((select jsonb_agg(jsonb_build_object(
          'originRiskId', r.id, 'originGesId', g.id, 'exposureGroup', g.name,
          'agentType', r.agent_type, 'description', r.description,
          'possibleInjuries', coalesce(r.possible_injuries,''),
          'originalData', jsonb_build_object('inventory', to_jsonb(r) - 'org_id', 'assessment',
            (select to_jsonb(a) - 'org_id' from public.risk_assessments a where a.risk_id=r.id and a.org_id=${orgId} order by a.assessed_at desc,a.id desc limit 1))
        ) order by g.id,r.id)
        from public.pgr_ges pg
        join public.ges g on g.id=pg.ges_id and g.org_id=${orgId} and g.company_id=p.company_id
        join public.risks r on r.ges_id=g.id and r.org_id=${orgId}
        where pg.pgr_id=p.id and pg.org_id=${orgId}), '[]'::jsonb) as risks
      from public.pgr p where p.id in (${sql.join(
        pgrIds.map((id) => sql`${id}`),
        sql`, `,
      )}) and p.company_id=${companyId} and p.org_id=${orgId}
    `);
    return rows as unknown as InternalMedicalSource[];
  });
}

type SourceInsert = typeof medicalRiskSources.$inferInsert;
export async function registerMedicalSource(
  orgId: string,
  companyId: string,
  actor: string,
  source: Omit<
    SourceInsert,
    "id" | "orgId" | "companyId" | "registeredBy" | "registeredAt"
  >,
  risks: MedicalRiskSnapshot[],
) {
  return auditedTenantWrite(orgId, "medicine.risk_sources.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [company] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
        .for("update")
        .limit(1);
      if (!company) throw new NotFoundError();
      await assertCompanyModuleTx(tx, orgId, companyId, "medicine");
      if (source.supersedesSourceId) {
        const [previous] = await tx
          .select({ id: medicalRiskSources.id })
          .from(medicalRiskSources)
          .where(
            and(
              eq(medicalRiskSources.id, source.supersedesSourceId),
              eq(medicalRiskSources.orgId, orgId),
              eq(medicalRiskSources.companyId, companyId),
            ),
          )
          .limit(1);
        if (!previous)
          throw new ReferenceNotFoundError("Fonte anterior não pertence a esta empresa.");
      }
      const [created] = await tx
        .insert(medicalRiskSources)
        .values({ ...source, orgId, companyId, registeredBy: actor })
        .returning();
      if (risks.length)
        await tx.insert(medicalRiskEntries).values(
          risks.map((content) => ({
            orgId,
            companyId,
            sourceId: created.id,
            content,
            status: "pending" as const,
          })),
        );
      await tx.insert(medicalRiskEvents).values({
        orgId,
        companyId,
        sourceId: created.id,
        actor,
        event: "source_registered_pending_review",
      });
      return created;
    }),
  );
}

export async function listMedicalSources(
  orgId: string,
  companyId: string,
  params: PageParams = {},
) {
  const { limit, offset } = resolvePageParams(params);
  return withOrg(orgId, async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
      .limit(1);
    if (!company) throw new NotFoundError();
    await assertCompanyModuleTx(tx, orgId, companyId, "medicine");
    const scope = and(
      eq(medicalRiskSources.orgId, orgId),
      eq(medicalRiskSources.companyId, companyId),
    );
    const sources = await tx
      .select()
      .from(medicalRiskSources)
      .where(scope)
      .orderBy(desc(medicalRiskSources.registeredAt), desc(medicalRiskSources.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(medicalRiskSources)
      .where(scope);
    if (!sources.length) return { rows: [], total };
    const ids = sources.map((row) => row.id);
    const risks = await tx
      .select()
      .from(medicalRiskEntries)
      .where(
        and(
          eq(medicalRiskEntries.orgId, orgId),
          eq(medicalRiskEntries.companyId, companyId),
          inArray(medicalRiskEntries.sourceId, ids),
        ),
      )
      .orderBy(medicalRiskEntries.id);
    // Successors are fetched independently of the current page (no false freshness).
    const successors = await tx
      .select({ previousId: medicalRiskSources.supersedesSourceId })
      .from(medicalRiskSources)
      .where(and(scope, inArray(medicalRiskSources.supersedesSourceId, ids)));
    return {
      rows: sources.map((source) => ({
        ...source,
        risks: risks.filter((risk) => risk.sourceId === source.id),
        superseded: successors.some((row) => row.previousId === source.id),
      })),
      total,
    };
  });
}
