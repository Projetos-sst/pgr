import { z } from "zod";

import type { Company } from "@/shared/db/schema";

import { cnpjSchema, riskGradeSchema } from "./validation";
import { optionalString, requiredString } from "./form-fields";

export type { Company } from "@/shared/db/schema";
export type { CompanyOption } from "@/shared/db/repositories/companies";

const cnpjOptional = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  cnpjSchema.optional(),
);

const riskGradeInput = z.coerce
  .number({ error: "Grau de risco é obrigatório (1 a 4)" })
  .pipe(riskGradeSchema);

export const companyInputSchema = z.object({
  cnpj: cnpjOptional,
  razaoSocial: requiredString("Razão social é obrigatória"),
  nomeFantasia: optionalString,
  phone: optionalString,
  email: optionalString,
  cnae: optionalString,
  mainActivity: optionalString,
  riskGrade: riskGradeInput,
  logoPath: optionalString,
  zipCode: optionalString,
  street: optionalString,
  number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
});

export type CompanyInput = z.input<typeof companyInputSchema>;
export type CompanyValues = z.output<typeof companyInputSchema>;

export type CompanyListItem = {
  id: string;
  razaoSocial: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
};

export function toCompanyListItem(row: Company): CompanyListItem {
  return {
    id: row.id,
    razaoSocial: row.razaoSocial,
    cnpj: row.cnpj,
    city: row.city,
    state: row.state,
  };
}

/** Formata CNPJ (14 dígitos) para exibição: 00.000.000/0000-00. */
export function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
