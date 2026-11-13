import "server-only";

import { z } from "zod";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import { db } from "@/shared/db";
import { listPublishedOffers } from "@/shared/db/repositories/commercial-catalog";
import * as contractsRepo from "@/shared/db/repositories/commercial-contracts";
import * as customersRepo from "@/shared/db/repositories/commercial-customers";
import {
  contractInputSchema,
  customerInputSchema,
  customerKindSchema,
  customerStatusSchema,
  customerUpdateSchema,
} from "@/shared/domains/commercial/contract";
import {
  isCommercialCatalogEnabledFor,
  sellableOffers,
  type CommercialEnvironment,
} from "@/shared/domains/commercial/offer";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

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

function commercialEnvironment(): CommercialEnvironment {
  return {
    APP_ENV: process.env.APP_ENV,
    COMMERCIAL_CATALOG_ENABLED: process.env.COMMERCIAL_CATALOG_ENABLED,
  };
}

function requireCommercialSurface(): CommercialEnvironment {
  const env = commercialEnvironment();
  if (!isCommercialCatalogEnabledFor(env))
    throw new ForbiddenError("O módulo comercial está desligado neste ambiente.");
  return env;
}

function requireFinancialOwner(ctx: TenantContext): CommercialEnvironment {
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

export async function registerContract(ctx: TenantContext, input: unknown) {
  const env = requireFinancialOwner(ctx);
  return contractsRepo.createContract(ctx, contractInputSchema.parse(input), {
    today: todayInSaoPaulo(),
    env,
  });
}
