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

/** Separadores tolerados ao comparar o número do registro: ponto, hífen, barra e espaços. */
const REGISTRATION_SEPARATORS = /[.\-/\s]/g;

/**
 * Forma canônica do número do registro profissional (CRM/CRP), usada SÓ para comparar formatos
 * (NOB-110/NOB-163): tira ponto, hífen, barra e espaços e mantém os dígitos exatamente como estão
 * (sem conversão numérica: zeros à esquerda contam, "012345" ≠ "12345"). Devolve `null` quando
 * sobra algo que não é dígito (ex.: "12345-MA", "CRM 12345") ou quando não há dígito: o valor não
 * é comparável. Nunca usar para reescrever o valor guardado nem para exibição.
 */
export function canonicalRegistrationNumber(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(REGISTRATION_SEPARATORS, "");
  return /^\d+$/.test(stripped) ? stripped : null;
}

/**
 * CRM do signatário informado no registro de ASO/PCMSO assinado: dígitos, com ponto, hífen, barra
 * ou espaço opcionais (até 10 dígitos). O valor é guardado como informado (aparado); a forma
 * canônica serve só para comparar com o cadastro.
 */
export const signerRegistrationSchema = z
  .string()
  .trim()
  .max(20, "CRM do signatário com no máximo 20 caracteres.")
  .refine(
    (value) => {
      const canonical = canonicalRegistrationNumber(value);
      return canonical !== null && canonical.length <= 10;
    },
    "CRM do signatário: só números (ponto, hífen, barra e espaço são aceitos como separadores; a UF vai no campo próprio).",
  );

/** UF comparável: sem espaços nas pontas, maiúscula; vazia → `null`. */
function canonicalUf(value: string | null | undefined): string | null {
  const uf = typeof value === "string" ? value.trim().toUpperCase() : "";
  return uf === "" ? null : uf;
}

/**
 * Resultado da conferência de consistência entre o registro do cadastro e o informado:
 * - `match`: mesmo número (forma canônica) e mesma UF (sem diferenciar maiúsculas);
 * - `mismatch`: número ou UF diferentes (ou UF ausente no cadastro);
 * - `registered_not_canonical`: o número do cadastro tem letras ou outro caractere além dos
 *   separadores — o escritório precisa corrigir o cadastro; o sistema não adivinha o número.
 */
export type RegistrationMatch = "match" | "mismatch" | "registered_not_canonical";

/**
 * Confere se o registro informado (signatário de ASO/PCMSO) é o do cadastro do profissional,
 * tolerando só diferenças de formatação. É conferência de CONSISTÊNCIA: nunca autoriza sozinha —
 * quem pode agir vem do vínculo verificado (`actor_clinical_medico_ids`).
 */
export function compareProfessionalRegistration(
  registered: { crm: string; uf: string | null },
  informed: { registration: string; uf: string },
): RegistrationMatch {
  const registeredNumber = canonicalRegistrationNumber(registered.crm);
  if (registeredNumber === null) return "registered_not_canonical";
  const informedNumber = canonicalRegistrationNumber(informed.registration);
  const registeredUf = canonicalUf(registered.uf);
  if (
    informedNumber === null ||
    informedNumber !== registeredNumber ||
    registeredUf === null ||
    registeredUf !== canonicalUf(informed.uf)
  )
    return "mismatch";
  return "match";
}

/**
 * Mensagem para cadastro com número de registro não comparável (letras ou outros caracteres):
 * decisão conservadora da NOB-110 — o sistema não remove sufixo de UF nem adivinha o número; o
 * escritório corrige o cadastro (o que, pela NOB-158, exige nova verificação de identidade).
 */
export function registeredNotCanonicalMessage(
  whose: string,
  registered: string,
): string {
  return `O CRM no cadastro ${whose} ("${registered}") tem letras ou caracteres além de ponto, hífen, barra e espaço. O escritório precisa corrigir o cadastro (só o número do CRM; a UF vai no campo próprio) antes de registrar o documento assinado.`;
}

/** "CRM 12345/SP" — identificação do registro para listas e documentos. */
export function formatProfessionalRegistration(
  medico: Pick<Medico, "crm" | "profession" | "registrationUf">,
): string {
  const council = REGISTRATION_COUNCIL[medico.profession];
  return medico.registrationUf
    ? `${council} ${medico.crm}/${medico.registrationUf}`
    : `${council} ${medico.crm} (UF não informada)`;
}
