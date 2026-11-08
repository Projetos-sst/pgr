/**
 * Afastamentos (NOB-139, MED-23). Regras puras:
 * - validação do registro administrativo;
 * - conflito de períodos;
 * - avaliação derivada na leitura.
 * A avaliação cobre o exame de retorno (NR-7 7.5.9, sempre sugestão para o médico) e a sinalização
 * informativa de possível encaminhamento à Previdência (NR-7 7.5.19.5 c), só no contexto de
 * doença ou acidente relacionado ao trabalho e sem decidir nexo, incapacidade ou CAT.
 */
import { z } from "zod";

import { todayInSaoPaulo } from "@/shared/dates";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

import { addDays, daysBetween, suggestReturnToWorkExam } from "./nr7-schedule-rules";

export const ABSENCE_CAUSES = ["illness", "accident", "other"] as const;
export type AbsenceCause = (typeof ABSENCE_CAUSES)[number];
export const WORK_RELATIONS = [
  "occupational",
  "non_occupational",
  "not_determined",
] as const;
export type WorkRelation = (typeof WORK_RELATIONS)[number];

export const ABSENCE_CAUSE_LABELS: Record<AbsenceCause, string> = {
  illness: "Doença",
  accident: "Acidente",
  other: "Outro motivo",
};
export const WORK_RELATION_LABELS: Record<WorkRelation, string> = {
  occupational: "Relacionado ao trabalho (informado)",
  non_occupational: "Não relacionado ao trabalho (informado)",
  not_determined: "Relação com o trabalho não determinada",
};

/** Limites normativos (dias corridos, contando o primeiro e o último dia). */
export const RETURN_EXAM_MIN_DAYS = 30; // NR-7 7.5.9
export const SOCIAL_SECURITY_REFERRAL_DAYS = 15; // NR-7 7.5.19.5 c: "superior a 15 dias"

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (message: string) =>
  z
    .string({ error: message })
    .regex(ISO, message)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
        new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v,
      message,
    );
const optionalIsoDate = (message: string) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    isoDate(message).optional(),
  );

export const absenceInputSchema = z
  .object({
    employeeId: requiredUuid("Funcionário é obrigatório."),
    cause: z.enum(ABSENCE_CAUSES, { error: "Informe a causa do afastamento." }),
    workRelation: z
      .enum(WORK_RELATIONS, { error: "Relação com o trabalho inválida." })
      .optional()
      .default("not_determined"),
    startsOn: isoDate("Data de início inválida."),
    endsOn: optionalIsoDate("Data de fim inválida."),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.endsOn && v.endsOn < v.startsOn)
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "O último dia de afastamento não pode ser anterior ao início.",
      });
    if (v.cause === "other" && v.workRelation !== "not_determined")
      ctx.addIssue({
        code: "custom",
        path: ["workRelation"],
        message: "Para outro motivo, a relação com o trabalho não se aplica.",
      });
  });
export type AbsenceValues = z.output<typeof absenceInputSchema>;

export const absenceEndSchema = z
  .object({ endsOn: z.union([isoDate("Data de fim inválida."), z.null()]) })
  .strict();

export const absenceReturnSchema = z
  .object({ returnedOn: isoDate("Data de retorno inválida.") })
  .strict()
  .refine((v) => v.returnedOn <= todayInSaoPaulo(), {
    path: ["returnedOn"],
    message: "O retorno confirmado não pode ser no futuro.",
  });

export const absenceCancelSchema = z
  .object({
    reason: z
      .string({ error: "Descreva o motivo do cancelamento." })
      .trim()
      .min(10, "Descreva o motivo (mínimo de 10 caracteres).")
      .max(1000, "Máximo de 1000 caracteres."),
  })
  .strict();

/** Último dia efetivo do período: véspera do retorno confirmado, fim informado ou em aberto. */
export function lastDayOf(a: { endsOn: string | null; returnedOn: string | null }) {
  if (a.returnedOn) return addDays(a.returnedOn, -1);
  return a.endsOn;
}

/** Dois períodos se cruzam? Fim desconhecido = em aberto (vai até o infinito). */
export function periodsOverlap(
  a: { startsOn: string; endsOn: string | null; returnedOn: string | null },
  b: { startsOn: string; endsOn: string | null; returnedOn: string | null },
): boolean {
  const aEnd = lastDayOf(a) ?? "9999-12-31";
  const bEnd = lastDayOf(b) ?? "9999-12-31";
  return a.startsOn <= bEnd && b.startsOn <= aEnd;
}

export type ReturnExamState =
  | "not_applicable" // outro motivo: a regra de doença/acidente não se aplica
  | "not_required" // < 30 dias com período conhecido
  | "monitor" // em andamento, sem data de fim, ainda abaixo de 30 dias
  | "required"; // ≥ 30 dias (conhecido ou já transcorrido)

export type AbsenceAssessment = {
  status: "ongoing" | "returned" | "cancelled";
  /** Dias já transcorridos até hoje (ou até o último dia conhecido, se anterior). */
  elapsedDays: number;
  /** Duração total, só quando o último dia é conhecido. */
  knownDays: number | null;
  returnExam: {
    state: ReturnExamState;
    reason: string;
    mustBeDoneBefore: string | null;
    /** Exame de retorno efetivamente registrado no cadastro de exames, se houver. */
    recordedOn: string | null;
    requiresMedicalConfirmation: true;
    reference: "NR-7 7.5.9";
  };
  /** Sinalização informativa (não decide nexo, incapacidade nem CAT). */
  socialSecurityReferral: { flagged: boolean; reason: string } | null;
};

/**
 * Avaliação derivada do afastamento. O retorno só é "realizado" com a data confirmada; o exame só
 * conta como registrado se existir exame de retorno com data a partir do início do afastamento.
 */
export function assessAbsence(
  absence: {
    cause: AbsenceCause;
    workRelation: WorkRelation;
    startsOn: string;
    endsOn: string | null;
    returnedOn: string | null;
    cancelledAt: string | Date | null;
  },
  returnExamDates: readonly string[],
  today: string,
): AbsenceAssessment {
  const status = absence.cancelledAt
    ? "cancelled"
    : absence.returnedOn
      ? "returned"
      : "ongoing";
  const lastDay = lastDayOf(absence);
  const knownDays = lastDay ? daysBetween(absence.startsOn, lastDay) + 1 : null;
  const reference = lastDay && lastDay < today ? lastDay : today;
  const elapsedDays = Math.max(0, daysBetween(absence.startsOn, reference) + 1);
  const recordedOn =
    [...returnExamDates].filter((d) => d >= absence.startsOn).sort()[0] ?? null;

  const base = {
    requiresMedicalConfirmation: true as const,
    reference: "NR-7 7.5.9" as const,
    recordedOn,
  };
  let returnExam: AbsenceAssessment["returnExam"];
  if (absence.cause === "other") {
    returnExam = {
      ...base,
      state: "not_applicable",
      mustBeDoneBefore: null,
      reason:
        "Afastamento por outro motivo: a regra do exame de retorno (doença ou acidente, NR-7 7.5.9) não se aplica automaticamente. O médico avalia o caso.",
    };
  } else if (lastDay) {
    const s = suggestReturnToWorkExam({
      absenceStartOn: absence.startsOn,
      lastAbsenceDayOn: lastDay,
    });
    returnExam = {
      ...base,
      state: s.required ? "required" : "not_required",
      mustBeDoneBefore: s.required ? s.mustBeDoneBefore : null,
      reason: absence.returnedOn
        ? s.reason
        : `${s.reason} Fim ${absence.endsOn ? "informado" : "não informado"}; o retorno ainda não foi confirmado.`,
    };
  } else if (elapsedDays >= RETURN_EXAM_MIN_DAYS) {
    returnExam = {
      ...base,
      state: "required",
      mustBeDoneBefore: null,
      reason: `Afastamento em andamento que já soma ${elapsedDays} dias (≥ 30): o exame de retorno será necessário antes de reassumir as funções.`,
    };
  } else {
    returnExam = {
      ...base,
      state: "monitor",
      mustBeDoneBefore: null,
      reason: `Afastamento em andamento, sem data de fim, com ${elapsedDays} dia(s) até hoje. Se chegar a 30 dias, o exame de retorno será necessário (NR-7 7.5.9).`,
    };
  }

  const duration = knownDays ?? elapsedDays;
  const socialSecurityReferral =
    absence.cause === "other" || status === "cancelled"
      ? null
      : absence.workRelation === "occupational" &&
          duration > SOCIAL_SECURITY_REFERRAL_DAYS
        ? {
            flagged: true,
            reason: `Afastamento informado como relacionado ao trabalho, com ${duration} dias (> 15). Para análise: a NR-7 7.5.19.5 c prevê o encaminhamento à Previdência Social pela organização, após informação do médico responsável pelo PCMSO, quando constatada doença relacionada ao trabalho. O sistema não decide nexo, incapacidade nem emite CAT, e não registra o encaminhamento como feito.`,
          }
        : {
            flagged: false,
            reason:
              absence.workRelation === "occupational"
                ? `Afastamento relacionado ao trabalho com ${duration} dia(s): abaixo do limite de 15 dias da NR-7 7.5.19.5 c.`
                : "A sinalização da NR-7 7.5.19.5 c só se aplica a doença ou acidente informado como relacionado ao trabalho.",
          };

  return { status, elapsedDays, knownDays, returnExam, socialSecurityReferral };
}

export const RETURN_EXAM_STATE_LABELS: Record<ReturnExamState, string> = {
  not_applicable: "Regra de retorno não se aplica",
  not_required: "Exame de retorno não exigido pela regra dos 30 dias",
  monitor: "Acompanhar duração",
  required: "Exame de retorno sugerido (confirmação médica)",
};

// ── Área clínica (atestado e CID) ────────────────────────────────────────────

export const absenceClinicalNoteSchema = z
  .object({
    cid: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-TV-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/, "CID-10 inválido (ex.: M54.5).")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    workerAuthorization: z
      .string()
      .trim()
      .max(1000, "Máximo de 1.000 caracteres.")
      .optional(),
    content: z.string().trim().max(5000, "Máximo de 5.000 caracteres.").optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.cid && !v.workerAuthorization)
      ctx.addIssue({
        code: "custom",
        path: ["workerAuthorization"],
        message:
          "O CID só é registrado com a autorização do trabalhador (referência do termo).",
      });
    if (!v.cid && !v.content)
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "Informe o conteúdo do atestado ou o CID autorizado.",
      });
  });
export type AbsenceClinicalNoteValues = z.output<typeof absenceClinicalNoteSchema>;
