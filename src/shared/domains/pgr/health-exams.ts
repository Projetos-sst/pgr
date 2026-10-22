import { z } from "zod";

import type { HealthExam } from "@/shared/db/schema/health-exams";
import { classifyDocumentValidity } from "@/shared/domains/documents/validity";
import { todayInSaoPaulo } from "@/shared/dates";

import {
  optionalIsoDate,
  optionalUuid,
  optionalUuidWith,
  requiredUuid,
} from "./form-fields";

export type { HealthExam };

// ── Tipo de exame ────────────────────────────────────────────────────────────

export const EXAM_TYPES = [
  "admissional",
  "periodic",
  "change_of_function",
  "return_to_work",
  "dismissal",
] as const;

export const examTypeSchema = z.enum(EXAM_TYPES, { error: "Tipo de exame inválido" });

export type ExamType = (typeof EXAM_TYPES)[number];

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  admissional: "Admissional",
  periodic: "Periódico",
  change_of_function: "Mudança de Função",
  return_to_work: "Retorno ao Trabalho",
  dismissal: "Demissional",
};

// ── Aptidão (resultado do ASO) ───────────────────────────────────────────────

export const EXAM_APTITUDES = ["fit", "fit_with_restrictions", "unfit"] as const;

export const examAptitudeSchema = z.enum(EXAM_APTITUDES, { error: "Aptidão inválida" });

export type ExamAptitude = (typeof EXAM_APTITUDES)[number];

export const EXAM_APTITUDE_LABELS: Record<ExamAptitude, string> = {
  fit: "Apto",
  fit_with_restrictions: "Apto c/ restrição",
  unfit: "Inapto",
};

// ── Janela de vencimento ─────────────────────────────────────────────────────

/**
 * Janela (dias) do "a vencer" dos exames — única para `/health-exams`, painel da
 * Medicina e ficha do funcionário. Só a validade INFORMADA (`valid_until`); nenhuma
 * periodicidade é calculada.
 */
export const EXAM_DUE_WINDOW_DAYS = 30;

// ── Badge de status (validade derivada + aptidão) ────────────────────────────

export type ExamBadge = { tone: "green" | "amber" | "red"; label: string };

/**
 * Badge da coluna "Status" (espelho do mockup): a validade derivada tem
 * prioridade — `vencido` → vermelho, `a vencer` → âmbar; quando vigente (ou sem
 * validade), mostra a APTIDÃO (apto/apto c/ restrição/inapto). Validade derivada
 * na leitura por `classifyDocumentValidity` (nunca coluna).
 */
export function examBadge(
  validUntil: string | null,
  aptitude: ExamAptitude,
  { today, dueWindowDays }: { today: string; dueWindowDays: number },
): ExamBadge {
  const validity = classifyDocumentValidity(validUntil, { today, dueWindowDays });
  if (validity === "expired") return { tone: "red", label: "Vencido" };
  if (validity === "due_soon") return { tone: "amber", label: "A vencer" };
  if (aptitude === "fit") return { tone: "green", label: "Apto" };
  if (aptitude === "fit_with_restrictions")
    return { tone: "amber", label: "Apto c/ restrição" };
  return { tone: "red", label: "Inapto" };
}

// ── Input (create/update) ────────────────────────────────────────────────────

// Data de realização: calendário válido e não-futura (fuso America/Sao_Paulo).
const performedAtSchema = z.iso
  .date("Data inválida (use AAAA-MM-DD)")
  .refine((value) => value <= todayInSaoPaulo(), {
    message: "Data de realização não pode ser no futuro",
  });

// Limites de entrada dos campos administrativos (só aplicação; as colunas seguem
// `text`, e dados antigos maiores não são alterados).
export const HEALTH_EXAM_NOTES_MAX = 2000;
export const HEALTH_EXAM_CERTIFICATE_PATH_MAX = 500;

export const VALID_UNTIL_BEFORE_PERFORMED_MESSAGE = "Vencimento anterior à realização.";
export const EMPLOYEE_CHANGE_MESSAGE =
  "O funcionário de um exame já registrado não pode ser alterado.";

function boundedOptionalString(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? undefined : value))
    .optional();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Vencimento anterior à realização? Compara as datas de calendário AAAA-MM-DD
 * como texto (ordem lexical = ordem cronológica), sem `Date` nem fuso. Vencimento
 * igual à realização é permitido; vencimento ausente não é comparado.
 */
export function isValidUntilBeforePerformedAt(
  performedAt: string | null | undefined,
  validUntil: string | null | undefined,
): boolean {
  if (!performedAt || !validUntil) return false;
  if (!ISO_DATE.test(performedAt) || !ISO_DATE.test(validUntil)) return false;
  return validUntil < performedAt;
}

export const healthExamInputSchema = z
  .object({
    employeeId: requiredUuid("Funcionário é obrigatório"),
    doctorId: optionalUuid,
    examType: examTypeSchema,
    performedAt: performedAtSchema,
    validUntil: optionalIsoDate,
    aptitude: examAptitudeSchema,
    notes: boundedOptionalString(
      HEALTH_EXAM_NOTES_MAX,
      `Observações: máximo de ${HEALTH_EXAM_NOTES_MAX.toLocaleString("pt-BR")} caracteres.`,
    ),
    certificatePath: boundedOptionalString(
      HEALTH_EXAM_CERTIFICATE_PATH_MAX,
      `Caminho do ASO: máximo de ${HEALTH_EXAM_CERTIFICATE_PATH_MAX} caracteres.`,
    ),
  })
  .refine((v) => !isValidUntilBeforePerformedAt(v.performedAt, v.validUntil), {
    path: ["validUntil"],
    message: VALID_UNTIL_BEFORE_PERFORMED_MESSAGE,
    // Roda mesmo com erro em outro campo (ex.: aptidão vazia), para a mensagem
    // das datas aparecer junto; a função ignora datas ausentes ou malformadas.
    when: (payload) => {
      const value = payload.value as { performedAt?: unknown; validUntil?: unknown };
      return (
        typeof value?.performedAt === "string" && typeof value?.validUntil === "string"
      );
    },
  });

export type HealthExamInput = z.input<typeof healthExamInputSchema>;
export type HealthExamValues = z.output<typeof healthExamInputSchema>;

/** Linha de listagem: exame + nomes resolvidos por join (funcionário/médico). */
export type HealthExamListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  doctorId: string | null;
  doctorName: string | null;
  examType: ExamType;
  performedAt: string;
  validUntil: string | null;
  aptitude: ExamAptitude;
};

// ── Filtros da listagem ──────────────────────────────────────────────────────

/**
 * Filtros por funcionário/empresa da listagem de exames. São só filtros SOMADOS a
 * `org_id` (tenant da sessão): ID de outro tenant → lista vazia; ID malformado →
 * `VALIDATION` (nunca lista vazia nem 500). `companyId` = empresa ATUAL do
 * funcionário (`employees.company_id`).
 */
export const healthExamListFiltersSchema = z.object({
  employeeId: optionalUuidWith("Funcionário inválido"),
  companyId: optionalUuidWith("Empresa inválida"),
  // Tipo fora do enum → VALIDATION (antes era ignorado em silêncio).
  examType: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    examTypeSchema.optional(),
  ),
});
