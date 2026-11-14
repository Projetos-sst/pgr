import "server-only";

import { z } from "zod";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import { db } from "@/shared/db";
import { listPublishedOffers } from "@/shared/db/repositories/commercial-catalog";
import * as contractsRepo from "@/shared/db/repositories/commercial-contracts";
import * as customersRepo from "@/shared/db/repositories/commercial-customers";
import * as interestsRepo from "@/shared/db/repositories/commercial-interests";
import * as trialsRepo from "@/shared/db/repositories/commercial-trials";
import {
  contractInputSchema,
  customerInputSchema,
  customerKindSchema,
  customerStatusSchema,
  customerUpdateSchema,
} from "@/shared/domains/commercial/contract";
import {
  interestFiltersSchema,
  interestIdSchema,
  interestInputSchema,
} from "@/shared/domains/commercial/interest";
import {
  isCommercialCatalogEnabledFor,
  sellableOffers,
  type CommercialEnvironment,
} from "@/shared/domains/commercial/offer";
import {
  trialCompanyIdSchema,
  trialFiltersSchema,
  trialInputSchema,
} from "@/shared/domains/commercial/trial";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

import { commercialEnvironment } from "./environment";

export { assertPgrEmissionAllowed } from "./emission-gate";

const pageNumber = z.number().int().positive().optional();
const customerFiltersSchema = z.object({
  page: pageNumber,
  pageSize: pageNumber,
  kind: customerKindSchema.optional(),
  status: customerStatusSchema.optional(),
});
const contractFiltersSchema = z.object({
  page: pageNumber,
  pageSize: pageNumber,
  customerId: requiredUuid("Cliente inválido.").optional(),
});
const customerId = requiredUuid("Cliente inválido.");
const contractId = requiredUuid("Contratação inválida.");

function requireCommercialSurface(): CommercialEnvironment {
  const env = commercialEnvironment();
  if (!isCommercialCatalogEnabledFor(env))
    throw new ForbiddenError("O módulo comercial está desligado neste ambiente.");
  return env;
}

export function requireFinancialOwner(ctx: TenantContext): CommercialEnvironment {
  const env = requireCommercialSurface();
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Apenas o administrador consulta e altera dados comerciais.",
    );
  return env;
}

export async function listSellableOffers(ctx: TenantContext) {
  const env = requireCommercialSurface();
  if (ctx.role === "client")
    throw new ForbiddenError("Apenas a equipe do escritório consulta o catálogo.");
  return sellableOffers(await listPublishedOffers(db), todayInSaoPaulo(), env);
}

export async function listCustomers(ctx: TenantContext, filters: unknown) {
  requireFinancialOwner(ctx);
  return customersRepo.listCustomers(ctx, customerFiltersSchema.parse(filters));
}

export async function getCustomer(ctx: TenantContext, id: string) {
  requireFinancialOwner(ctx);
  return customersRepo.getCustomer(ctx, customerId.parse(id));
}

export async function registerCustomer(ctx: TenantContext, input: unknown) {
  requireFinancialOwner(ctx);
  return customersRepo.createCustomer(ctx, customerInputSchema.parse(input));
}

export async function updateCustomer(ctx: TenantContext, id: string, input: unknown) {
  requireFinancialOwner(ctx);
  return customersRepo.updateCustomer(
    ctx,
    customerId.parse(id),
    customerUpdateSchema.parse(input),
  );
}

export async function listContracts(ctx: TenantContext, filters: unknown) {
  requireFinancialOwner(ctx);
  return contractsRepo.listContracts(ctx, contractFiltersSchema.parse(filters));
}

export async function getContract(ctx: TenantContext, id: string) {
  requireFinancialOwner(ctx);
  return contractsRepo.getContract(ctx, contractId.parse(id));
}

export async function registerInterest(ctx: TenantContext, input: unknown) {
  requireCommercialSurface();
  if (ctx.role !== "owner" && ctx.role !== "collaborator")
    throw new ForbiddenError(
      "Apenas a equipe do escritório registra interesse comercial.",
    );
  return interestsRepo.registerInterest(ctx, interestInputSchema.parse(input));
}

export async function listInterests(ctx: TenantContext, filters: unknown) {
  requireFinancialOwner(ctx);
  return interestsRepo.listInterests(ctx, interestFiltersSchema.parse(filters));
}

export async function markInterestSeen(ctx: TenantContext, id: string) {
  requireFinancialOwner(ctx);
  return interestsRepo.markInterestSeen(ctx, interestIdSchema.parse(id));
}

export function requireOfficeStaffRole(ctx: TenantContext, message: string): void {
  requireCommercialSurface();
  if (ctx.role !== "owner" && ctx.role !== "collaborator")
    throw new ForbiddenError(message);
}

export async function startCompanyTrial(
  ctx: TenantContext,
  input: unknown,
  now: Date = new Date(),
) {
  requireFinancialOwner(ctx);
  const { companyId } = trialInputSchema.parse(input);
  return trialsRepo.startTrial(ctx, companyId, now);
}

export async function getCompanyTrial(
  ctx: TenantContext,
  companyId: string,
  now: Date = new Date(),
) {
  requireOfficeStaffRole(
    ctx,
    "Apenas a equipe do escritório consulta o período de teste.",
  );
  return trialsRepo.getTrial(ctx, trialCompanyIdSchema.parse(companyId), now);
}

export async function listCompanyTrials(
  ctx: TenantContext,
  filters: unknown,
  now: Date = new Date(),
) {
  requireOfficeStaffRole(
    ctx,
    "Apenas a equipe do escritório consulta o período de teste.",
  );
  return trialsRepo.listTrials(ctx, trialFiltersSchema.parse(filters), now);
}

export async function registerContract(ctx: TenantContext, input: unknown) {
  const env = requireFinancialOwner(ctx);
  return contractsRepo.createContract(ctx, contractInputSchema.parse(input), {
    today: todayInSaoPaulo(),
    env,
  });
}
