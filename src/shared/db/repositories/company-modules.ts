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
import { auditedTenantWrite } from "./audited-write";
import { companyModuleScope } from "../schema/module-policy";

export async function assertCompanyModuleTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  module: CompanyModule,
): Promise<void> {
  const [enabled] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.orgId, orgId),
        eq(companies.id, companyId),
        companyModuleScope(companies.orgId, companies.id, module),
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
      .select({
        id: companies.id,
        pgr: companyModuleScope(companies.orgId, companies.id, "pgr"),
        medicine: companyModuleScope(companies.orgId, companies.id, "medicine"),
      })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
      .limit(1);
    if (!company) throw new NotFoundError();
    return COMPANY_MODULES.map((module) => ({
      module,
      enabled: company[module],
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
  return auditedTenantWrite(orgId, "platform.company_modules.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [company] = await tx
        .select({
          id: companies.id,
          effective: companyModuleScope(companies.orgId, companies.id, input.module),
        })
        .from(companies)
        .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
        .for("update")
        .limit(1);
      if (!company) throw new NotFoundError();
      const previousEnabled = company.effective;
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
    }),
  );
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
