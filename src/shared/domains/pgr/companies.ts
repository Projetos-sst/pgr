import { z } from "zod";

import { normalizeCnpj } from "./cnpj";

import { cnpjSchema, riskGradeSchema } from "./validation";
import { optionalString, optionalUrl, requiredString } from "./form-fields";

export type { Company } from "@/shared/db/schema";
export type { CompanyOption } from "@/shared/db/repositories/companies";

export const COMPANY_STATUSES = ["active", "pending", "inactive"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const companyStatusSchema = z.enum(COMPANY_STATUSES, {
  error: "Situação inválida",
});

/** Rótulos pt-BR da situação cadastral (enum em inglês no banco → UI pt-BR). */
export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  active: "Ativa",
  pending: "Pendente",
  inactive: "Inativa",
};

/** Tom do badge por situação (verde/âmbar/cinza), fiel ao mockup #188. */
export const COMPANY_STATUS_TONE: Record<CompanyStatus, "green" | "amber" | "neutral"> = {
  active: "green",
  pending: "amber",
  inactive: "neutral",
};

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
  website: optionalUrl,
  status: companyStatusSchema.default("active"),
  taxClassification: optionalString,
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
  pgrEnabled: boolean;
  medicineEnabled: boolean;
  id: string;
  razaoSocial: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  status: CompanyStatus;
  /** Contagens derivadas na leitura (sem coluna) — colunas Funcion./GES do #188. */
  employeeCount: number;
  gesCount: number;
};

/** Formata CNPJ (14 caracteres) para exibição: 00.000.000/0000-00. */
export function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return "—";
  const d = normalizeCnpj(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Aplica máscara de digitação progressiva ao CNPJ.
 * Preserva letras e números, trunca para 14 caracteres máximo,
 * e aplica a máscara 00.000.000/0000-00 conforme a quantidade de dígitos.
 * Funciona com qualquer quantidade de dígitos de 0 a 14 (idempotente).
 */
export function maskCnpjInput(value: string): string {
  // Preserva letras do CNPJ alfanumérico e remove caracteres de edição.
  const digits = normalizeCnpj(value).replace(/[^A-Z0-9]/g, "");

  // Trunca para máximo 14 dígitos
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  // 13 ou 14 dígitos
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}
