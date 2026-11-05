import "server-only";
import { z } from "zod";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { getCompanyCnaeForNtep } from "@/shared/db/repositories/company-ntep";
import {
  lookupNtep,
  parseCnaeClass,
  type NtepLookup,
} from "@/shared/domains/medicine/ntep/lista-c";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { ValidationError } from "@/shared/errors/validation-error";

const text = z.string().trim().max(32).optional().nullable();
const lookupSchema = z.object({
  cid: text,
  cnae: text,
  version: z.string().trim().max(300).optional().nullable(),
});

/** Código malformado é erro de entrada (422), nunca "sem correspondência". */
function rejectInvalid(result: NtepLookup): NtepLookup {
  if (result.kind === "invalid") throw new ValidationError(result.message);
  return result;
}

/**
 * Consulta a Lista C (catálogo global, sem dado de pessoa). Indisponível, não validado e versão
 * inexistente voltam explícitos no `kind`, distintos de `no_match`.
 */
export function lookupNtepCatalog(input: unknown): NtepLookup {
  return rejectInvalid(lookupNtep(lookupSchema.parse(input ?? {})));
}

export type CompanyNtep = {
  company: { id: string; razaoSocial: string; cnae: string | null };
  cnaeClass: string | null;
  /** `missing_cnae`/`invalid_cnae`: o cadastro não permite consultar (não é "sem correspondência"). */
  status: "ok" | "missing_cnae" | "invalid_cnae";
  result: NtepLookup | null;
};

/** Intervalos CID-10 da Lista C para a classe CNAE cadastrada da empresa (Medicina habilitada). */
export async function companyNtep(
  ctx: TenantContext,
  companyId: string,
): Promise<CompanyNtep> {
  const id = requiredUuid("Empresa inválida.").parse(companyId);
  const company = await getCompanyCnaeForNtep(ctx.tenantId, id);
  if (!company.cnae?.trim())
    return { company, cnaeClass: null, status: "missing_cnae", result: null };
  const cnaeClass = parseCnaeClass(company.cnae);
  if (!cnaeClass)
    return { company, cnaeClass: null, status: "invalid_cnae", result: null };
  return { company, cnaeClass, status: "ok", result: lookupNtep({ cnae: cnaeClass }) };
}
