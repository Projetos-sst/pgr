import "server-only";

import { z } from "zod";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as invoicesRepo from "@/shared/db/repositories/billing-invoices";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

import { requireFinancialOwner } from "./commercial-core";

const pageNumber = z.number().int().positive().optional();
const invoiceFiltersSchema = z.object({
  page: pageNumber,
  pageSize: pageNumber,
  contractId: requiredUuid("Contratação inválida.").optional(),
});
const invoiceId = requiredUuid("Fatura inválida.");

export async function listInvoices(ctx: TenantContext, filters: unknown) {
  requireFinancialOwner(ctx);
  return invoicesRepo.listInvoices(ctx, invoiceFiltersSchema.parse(filters));
}

export async function getInvoice(ctx: TenantContext, id: string) {
  requireFinancialOwner(ctx);
  return invoicesRepo.getInvoice(ctx, invoiceId.parse(id));
}
