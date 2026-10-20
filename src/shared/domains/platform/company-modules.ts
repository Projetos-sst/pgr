import { z } from "zod";

/** Independent of the office's free/pro plan. Extend this catalog deliberately. */
export const COMPANY_MODULES = ["pgr", "medicine"] as const;
export type CompanyModule = (typeof COMPANY_MODULES)[number];
export const COMPANY_MODULE_LABELS: Record<CompanyModule, string> = {
  pgr: "PGR / Segurança do Trabalho",
  medicine: "Medicina do Trabalho",
};
export const companyModuleSchema = z.enum(COMPANY_MODULES);
export const companyModuleChangeSchema = z
  .object({
    module: companyModuleSchema,
    enabled: z.boolean(),
    reason: z.string().trim().min(1, "Informe o motivo da alteração.").max(500),
  })
  .strict();

export type CompanyModuleChange = z.infer<typeof companyModuleChangeSchema>;
export type CompanyModuleView = { module: CompanyModule; enabled: boolean };

/** Missing entitlement always denies access; new companies start without modules. */
export function moduleIsEnabled(
  modules: readonly CompanyModuleView[],
  module: CompanyModule,
): boolean {
  return modules.some((entry) => entry.module === module && entry.enabled);
}
