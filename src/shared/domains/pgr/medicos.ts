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
  .refine((value) => {
    const canonical = canonicalRegistrationNumber(value);
    return canonical !== null && canonical.length <= 10;
  }, "CRM do signatário: só números (ponto, hífen, barra e espaço são aceitos como separadores; a UF vai no campo próprio).");

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
export function registeredNotCanonicalMessage(whose: string, registered: string): string {
  return `O CRM no cadastro ${whose} ("${registered}") tem letras ou caracteres além de ponto, hífen, barra e espaço. O escritório precisa corrigir o cadastro (só o número do CRM; a UF vai no campo próprio) antes de registrar o documento assinado.`;
}

/**
 * Prevenção de cadastro duplicado por formatação (NOB-110/NOB-112). Um registro é o MESMO quando
 * coincidem escritório, categoria profissional (CRM ≠ CRP), UF do conselho (sem diferenciar
 * maiúsculas) e número na forma canônica. UF diferente, categoria diferente ou zero à esquerda a
 * mais são registros DIFERENTES. Cadastro antigo sem UF (anterior à 0060) com o mesmo número e
 * categoria conta como possível duplicata de qualquer UF: o escritório completa a UF dele antes de
 * cadastrar outro. Nada aqui junta, apaga ou corrige cadastro: só impede criar um novo igual.
 */
export type RegistrationScope = {
  profession: MedicalProfession;
  uf: string;
  number: string;
};

type RegistrationFields = {
  crm: string;
  profession: MedicalProfession;
  registrationUf: string | null | undefined;
};

/** Escopo comparável do registro; `null` quando o número não é canônico ou falta a UF. */
export function registrationScope(fields: RegistrationFields): RegistrationScope | null {
  const number = canonicalRegistrationNumber(fields.crm);
  const uf = canonicalUf(fields.registrationUf);
  if (number === null || uf === null) return null;
  return { profession: fields.profession, uf, number };
}

/** Chave do lock transacional que serializa gravações concorrentes do mesmo registro. */
export function registrationLockKey(orgId: string, scope: RegistrationScope): string {
  return `medico-registration:${orgId}:${scope.profession}:${scope.uf}:${scope.number}`;
}

/**
 * Na edição, a conferência de duplicidade só roda se o registro mudar: outro número canônico,
 * outra categoria ou troca de UF já informada. Completar a UF de cadastro antigo (nula → UF) ou só
 * reformatar o número não é mudança — assim duplicatas antigas continuam editáveis (nome, status,
 * clínica…) sem ficarem presas, e nenhuma duplicata nova nasce por edição.
 */
export function registrationIdentityChanged(
  stored: RegistrationFields,
  next: RegistrationFields,
): boolean {
  if (stored.profession !== next.profession) return true;
  if (canonicalRegistrationNumber(stored.crm) !== canonicalRegistrationNumber(next.crm))
    return true;
  const storedUf = canonicalUf(stored.registrationUf);
  return storedUf !== null && storedUf !== canonicalUf(next.registrationUf);
}

export type RegistrationDuplicate = "same_uf" | "missing_uf";

/**
 * Procura, entre outros cadastros do escritório, um com o mesmo registro do escopo: mesma
 * categoria, mesmo número canônico e mesma UF (`same_uf`) ou UF não informada (`missing_uf`).
 * Cadastro com número não canônico (letras etc.) nunca é considerado: o sistema não adivinha.
 */
export function findRegistrationDuplicate(
  others: readonly RegistrationFields[],
  scope: RegistrationScope,
): RegistrationDuplicate | null {
  let missingUf = false;
  for (const other of others) {
    if (other.profession !== scope.profession) continue;
    if (canonicalRegistrationNumber(other.crm) !== scope.number) continue;
    const uf = canonicalUf(other.registrationUf);
    if (uf === scope.uf) return "same_uf";
    if (uf === null) missingUf = true;
  }
  return missingUf ? "missing_uf" : null;
}

export const MEDICO_REGISTRATION_DUPLICATE_MESSAGE =
  "Já existe outro profissional com este registro neste escritório (mesma categoria, mesma UF e mesmo número; ponto, hífen, barra e espaço não diferenciam registros). Use o cadastro existente.";

export const MEDICO_REGISTRATION_MISSING_UF_DUPLICATE_MESSAGE =
  "Já existe outro profissional com este número de registro e categoria sem UF informada neste escritório. Se for o mesmo profissional, use o cadastro existente; se não for, complete a UF daquele cadastro antes.";

export const MEDICO_CRM_TAKEN_MESSAGE =
  "Este número de registro já está cadastrado neste escritório.";

/** Exclusão recusada (IN_USE): o profissional examinou exames registrados; inativar. */
export const MEDICO_EXAMINER_IN_USE_MESSAGE =
  "Este profissional é examinador de exames registrados e não pode ser excluído. Inative o cadastro.";

export function registrationDuplicateMessage(kind: RegistrationDuplicate): string {
  return kind === "same_uf"
    ? MEDICO_REGISTRATION_DUPLICATE_MESSAGE
    : MEDICO_REGISTRATION_MISSING_UF_DUPLICATE_MESSAGE;
}

/**
 * Conta (sem expor dados pessoais) os grupos de possíveis duplicatas já gravadas no escritório:
 * mesma categoria e mesmo número canônico com UF repetida, ou com algum cadastro sem UF. Uso
 * operacional, só leitura: o sistema não junta nem corrige nada sozinho.
 */
export function countRegistrationDuplicateGroups(
  rows: readonly RegistrationFields[],
): number {
  const buckets = new Map<string, Array<string | null>>();
  for (const row of rows) {
    const number = canonicalRegistrationNumber(row.crm);
    if (number === null) continue;
    const key = `${row.profession}:${number}`;
    const ufs = buckets.get(key) ?? [];
    ufs.push(canonicalUf(row.registrationUf));
    buckets.set(key, ufs);
  }
  let groups = 0;
  for (const ufs of buckets.values()) {
    if (ufs.length < 2) continue;
    const known = ufs.filter((uf): uf is string => uf !== null);
    if (known.length < ufs.length || new Set(known).size < known.length) groups += 1;
  }
  return groups;
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
