import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import {
  COMPANY_MODULES,
  type CompanyModule,
  type CompanyModuleView,
} from "@/shared/domains/platform/company-modules";
import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import { companyModules, companyModuleEvents } from "../schema/company-modules";
import { resolvePageParams, type PageParams } from "@/shared/pagination";
import type { CompanyModuleChange } from "@/shared/domains/platform/company-modules";

export async function assertCompanyModuleTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  module: CompanyModule,
): Promise<void> {
  const [enabled] = await tx
    .select({ id: companyModules.id })
    .from(companyModules)
    .where(
      and(
        eq(companyModules.orgId, orgId),
        eq(companyModules.companyId, companyId),
        eq(companyModules.module, module),
        eq(companyModules.enabled, true),
      ),
    )
    .limit(1);
  if (!enabled) throw new ForbiddenError("Serviço não habilitado para esta empresa.");
}

export async function getCompanyModules(
  orgId: string,
  companyId: string,
): Promise<CompanyModuleView[]> {
  return withOrg(orgId, async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
      .limit(1);
    if (!company) throw new NotFoundError();
    const rows = await tx
      .select()
      .from(companyModules)
      .where(
        and(eq(companyModules.orgId, orgId), eq(companyModules.companyId, companyId)),
      );
    return COMPANY_MODULES.map((module) => ({
      module,
      enabled: rows.some((row) => row.module === module && row.enabled),
    }));
  });
}

/** Company row lock serializes enable/disable and its append-only event. */
export async function setCompanyModule(
  orgId: string,
  companyId: string,
  actor: string,
  input: CompanyModuleChange,
): Promise<void> {
  return withOrg(orgId, async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
      .for("update")
      .limit(1);
    if (!company) throw new NotFoundError();
    const scope = and(
      eq(companyModules.orgId, orgId),
      eq(companyModules.companyId, companyId),
      eq(companyModules.module, input.module),
    );
    const [current] = await tx.select().from(companyModules).where(scope).limit(1);
    const previousEnabled = current?.enabled ?? false;
    if (previousEnabled === input.enabled) return;
    await tx
      .insert(companyModules)
      .values({ orgId, companyId, module: input.module, enabled: input.enabled })
      .onConflictDoUpdate({
        target: [companyModules.orgId, companyModules.companyId, companyModules.module],
        set: { enabled: input.enabled, updatedAt: new Date() },
      });
    await tx.insert(companyModuleEvents).values({
      orgId,
      companyId,
      module: input.module,
      previousEnabled,
      enabled: input.enabled,
      changedBy: actor,
      reason: input.reason,
    });
  });
}

export async function listCompanyModuleEvents(
  orgId: string,
  companyId: string,
  params: PageParams = {},
) {
  const { limit, offset } = resolvePageParams(params);
  return withOrg(orgId, async (tx) => {
    const scope = and(
      eq(companyModuleEvents.orgId, orgId),
      eq(companyModuleEvents.companyId, companyId),
    );
    const rows = await tx
      .select()
      .from(companyModuleEvents)
      .where(scope)
      .orderBy(desc(companyModuleEvents.changedAt), desc(companyModuleEvents.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(companyModuleEvents)
      .where(scope);
    return { rows, total };
  });
}
