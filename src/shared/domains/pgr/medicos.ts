import { z } from "zod";

import type { Medico } from "@/shared/db/schema/medicos";

import { optionalString, requiredString } from "./form-fields";

export type { Medico };

export const MEDICO_STATUSES = ["active", "inactive"] as const;

export const medicoStatusSchema = z.enum(MEDICO_STATUSES, {
  error: "Status inválido",
});

export type MedicoStatus = (typeof MEDICO_STATUSES)[number];

/** Rótulos pt-BR do status (enum em inglês no banco → UI em pt-BR). */
export const MEDICO_STATUS_LABELS: Record<MedicoStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
};

/** Categoria profissional (NOB-121). O registro é CRM para médico e CRP para psicólogo. */
export const MEDICAL_PROFESSIONS = ["physician", "psychologist"] as const;
export type MedicalProfession = (typeof MEDICAL_PROFESSIONS)[number];
export const MEDICAL_PROFESSION_LABELS: Record<MedicalProfession, string> = {
  physician: "Médico",
  psychologist: "Psicólogo",
};
export const REGISTRATION_COUNCIL: Record<MedicalProfession, string> = {
  physician: "CRM",
  psychologist: "CRP",
};

/** Vínculo com o escritório: equipe própria ou externo (clínica, indicado pela empresa). */
export const MEDICAL_AFFILIATIONS = ["internal", "external"] as const;
export type MedicalAffiliation = (typeof MEDICAL_AFFILIATIONS)[number];
export const MEDICAL_AFFILIATION_LABELS: Record<MedicalAffiliation, string> = {
  internal: "Equipe do escritório",
  external: "Externo",
};

export const BRAZILIAN_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const ufSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.enum(BRAZILIAN_UFS, { error: "Informe a UF do conselho profissional" }),
);

export const medicoInputSchema = z
  .object({
    name: requiredString("Nome é obrigatório"),
    crm: requiredString("Número do registro profissional é obrigatório").pipe(
      z.string().max(20, "Registro profissional com no máximo 20 caracteres"),
    ),
    profession: z
      .enum(MEDICAL_PROFESSIONS, { error: "Categoria profissional inválida" })
      .default("physician"),
    registrationUf: ufSchema,
    rqe: optionalString.pipe(
      z.string().max(20, "RQE com no máximo 20 caracteres").optional(),
    ),
    affiliation: z
      .enum(MEDICAL_AFFILIATIONS, { error: "Vínculo inválido" })
      .default("internal"),
    specialty: optionalString,
    clinic: optionalString,
    phone: optionalString,
    status: medicoStatusSchema.default("active"),
  })
  .refine((v) => v.profession === "physician" || v.rqe === undefined, {
    path: ["rqe"],
    message: "RQE só se aplica a médico",
  });

export type MedicoInput = z.input<typeof medicoInputSchema>;
export type MedicoValues = z.output<typeof medicoInputSchema>;

/** DTO de listagem: `MedicoListItem = Medico` (rótulo de status formatado na UI). */
export type MedicoListItem = Medico;

/** Opção (id + nome) para selects (ex.: médico responsável em exames/ASO). */
export type MedicoOption = Pick<Medico, "id" | "name" | "crm">;

/** "CRM 12345/SP" — identificação do registro para listas e documentos. */
export function formatProfessionalRegistration(
  medico: Pick<Medico, "crm" | "profession" | "registrationUf">,
): string {
  const council = REGISTRATION_COUNCIL[medico.profession];
  return medico.registrationUf
    ? `${council} ${medico.crm}/${medico.registrationUf}`
    : `${council} ${medico.crm} (UF não informada)`;
}
