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
