import "server-only";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  companyAuthorizerSchema,
  professionalAuthorizationSchema,
  medicalRiskDecisionSchema,
} from "@/shared/domains/medicine/risk-authorization";
import * as repo from "@/shared/db/repositories/risk-authorizations";
import { listMembershipsByOrg } from "@/shared/db/repositories/org-memberships";
import { getMedicalRiskInventory } from "./risk-source-core";
import { ForbiddenError } from "@/shared/auth/errors";
import type { PageParams } from "@/shared/pagination";
const id = (value: string) => requiredUuid("Identificador inválido.").parse(value);

export async function riskAuthorizationWorkspace(
  ctx: TenantContext,
  companyId: string,
  page: PageParams = {},
) {
  const company = id(companyId);
  const access = await repo.getRiskAuthorizationWorkspace(ctx, company, page);
  const members =
    access.canAppoint || access.canAuthorize
      ? await listMembershipsByOrg(ctx.tenantId, { page: 1, pageSize: 1000 })
      : { rows: [], total: 0 };
  const candidates = members.rows
    .filter((m) => !m.scopedCompanyId || m.scopedCompanyId === company)
    .filter(
      (m) =>
        access.appointmentOrigin !== "company_representative" || m.userId !== ctx.userId,
    )
    .map((m) => ({
      userId: m.userId,
      label:
        [m.firstName, m.lastName].filter(Boolean).join(" ") ||
        m.email ||
        "Conta cadastrada",
      email: m.email,
    }));
  let inventory: Awaited<ReturnType<typeof getMedicalRiskInventory>> | null = null;
  let inventoryNotice: string | null = null;
  try {
    inventory = await getMedicalRiskInventory(ctx, company, page);
  } catch (error) {
    if (error instanceof ForbiddenError)
      inventoryNotice = "Medicina não está habilitada para esta empresa.";
    else throw error;
  }
  const candidatesNotice =
    members.total > members.rows.length
      ? "A lista exibe as primeiras 1.000 contas da organização. Solicite à equipe a seleção da conta pelo identificador na API se ela não estiver nesta lista."
      : null;
  return { ...access, candidates, candidatesNotice, inventory, inventoryNotice };
}
export async function appointCompanyAuthorizer(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  await repo.setCompanyRiskAuthorizer(
    ctx,
    id(companyId),
    companyAuthorizerSchema.parse(input),
  );
  return { saved: true };
}
export async function authorizeCompanyProfessional(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  await repo.setProfessionalRiskAuthorization(
    ctx,
    id(companyId),
    professionalAuthorizationSchema.parse(input),
  );
  return { saved: true };
}
export async function decideCompanyRisk(
  ctx: TenantContext,
  companyId: string,
  entryId: string,
  input: unknown,
) {
  return repo.reviewMedicalRisk(
    ctx,
    id(companyId),
    id(entryId),
    medicalRiskDecisionSchema.parse(input),
  );
}
