import { z } from "zod";

/**
 * Apresentação e discussão do relatório analítico do PCMSO (NOB-168; NR-7 7.6.5: o relatório deve
 * ser apresentado e discutido com os responsáveis por segurança e saúde no trabalho da organização,
 * incluindo a CIPA, quando existente, para que as medidas de prevenção sejam consideradas).
 *
 * - Só uma versão **finalizada** pelo médico responsável que a elaborou é apresentada; a prévia
 *   sozinha não.
 * - Apresentação e discussão são registros de atos efetivamente realizados (agendar, gerar arquivo
 *   ou abrir a tela não contam). Medidas discutidas não viram "executadas".
 * - CIPA: cadastro vazio não prova que não existe; "sem CIPA" exige a referência da verificação, e
 *   "situação desconhecida" impede declarar o cumprimento integral. SESMT não é obrigatório.
 * - Dados mínimos: funções e, opcionalmente, nomes dos participantes; nada clínico individual.
 */

export const REPORT_PARTICIPANT_ROLES = [
  "cipa",
  "sesmt",
  "sst_responsible",
  "employer",
  "pcmso_coordinator",
  "other",
] as const;
export type ReportParticipantRole = (typeof REPORT_PARTICIPANT_ROLES)[number];
export const REPORT_PARTICIPANT_ROLE_LABELS: Record<ReportParticipantRole, string> = {
  cipa: "Representante da CIPA",
  sesmt: "SESMT",
  sst_responsible: "Responsável por SST da organização",
  employer: "Representante do empregador",
  pcmso_coordinator: "Médico responsável pelo PCMSO",
  other: "Outra função",
};

export const REPORT_MODALITIES = ["in_person", "remote", "hybrid"] as const;
export const REPORT_MODALITY_LABELS: Record<(typeof REPORT_MODALITIES)[number], string> =
  {
    in_person: "Presencial",
    remote: "Remota (ao vivo)",
    hybrid: "Híbrida",
  };

export const CIPA_SITUATIONS = [
  "participated",
  "exists_not_participated",
  "not_constituted",
  "unknown",
] as const;
export type CipaSituation = (typeof CIPA_SITUATIONS)[number];
export const CIPA_SITUATION_LABELS: Record<CipaSituation, string> = {
  participated: "A CIPA existe e participou",
  exists_not_participated: "A CIPA existe, mas não participou",
  not_constituted: "A organização não tem CIPA constituída (verificado)",
  unknown: "Situação da CIPA não verificada",
};

const participantSchema = z
  .object({
    role: z.enum(REPORT_PARTICIPANT_ROLES, { error: "Função do participante inválida." }),
    name: z
      .string()
      .trim()
      .max(120, "Máximo de 120 caracteres.")
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .strict();
const participantsSchema = z
  .array(participantSchema)
  .min(1, "Informe ao menos uma função representada.")
  .max(30, "Máximo de 30 participantes.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

const occurredOn = z.iso.date("Data inválida.");

export const reportFinalizeSchema = z
  .object({ kind: z.literal("finalized"), note: optionalText(1000) })
  .strict();

export const reportPresentationSchema = z
  .object({
    kind: z.literal("presented"),
    occurredOn,
    modality: z.enum(REPORT_MODALITIES, { error: "Informe a modalidade." }),
    participants: participantsSchema,
    cipaSituation: z.enum(CIPA_SITUATIONS, { error: "Informe a situação da CIPA." }),
    cipaReference: optionalText(500),
    evidenceReference: optionalText(500),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.cipaSituation === "not_constituted" &&
      (!v.cipaReference || v.cipaReference.length < 5)
    )
      ctx.addIssue({
        code: "custom",
        path: ["cipaReference"],
        message:
          "Informe como foi verificado que não há CIPA constituída (mínimo de 5 caracteres).",
      });
    if (
      v.cipaSituation === "participated" &&
      !v.participants.some((p) => p.role === "cipa")
    )
      ctx.addIssue({
        code: "custom",
        path: ["participants"],
        message:
          "Se a CIPA participou, inclua o representante da CIPA entre os participantes.",
      });
  });

const measureSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(5, "Descreva a medida ou o encaminhamento (mínimo de 5 caracteres).")
      .max(1000, "Máximo de 1.000 caracteres."),
    responsible: optionalText(200).transform((v) => v ?? undefined),
    dueDate: z
      .union([z.iso.date("Prazo inválido."), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .strict();

export const reportDiscussionSchema = z
  .object({
    kind: z.literal("discussed"),
    occurredOn,
    participants: participantsSchema,
    summary: z
      .string()
      .trim()
      .min(10, "Registre a síntese da discussão (mínimo de 10 caracteres).")
      .max(4000, "Máximo de 4.000 caracteres."),
    measures: z
      .array(measureSchema)
      .max(50, "Máximo de 50 itens.")
      .optional()
      .default([]),
    evidenceReference: optionalText(500),
  })
  .strict();

export const reportEventInputSchema = z.discriminatedUnion("kind", [
  reportFinalizeSchema,
  reportPresentationSchema,
  reportDiscussionSchema,
]);
export type ReportEventInput = z.output<typeof reportEventInputSchema>;

export const reportEventVoidSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, "Explique a correção em pelo menos 10 caracteres.")
      .max(1000, "Máximo de 1.000 caracteres."),
  })
  .strict();

/** Data do ato: não futura e não anterior à geração da versão (data local). */
export function occurredOnProblem(
  occurredOn: string,
  reportGeneratedOn: string,
  today: string,
): string | null {
  if (occurredOn > today)
    return "A data não pode ser futura: registre só atos já realizados.";
  if (occurredOn < reportGeneratedOn)
    return "A data é anterior à geração desta versão do relatório.";
  return null;
}

export type ReportPresentationState =
  | "no_report"
  | "not_finalized"
  | "pending_presentation"
  | "discussion_pending"
  | "presented_and_discussed";
export const REPORT_PRESENTATION_STATE_LABELS: Record<ReportPresentationState, string> = {
  no_report: "Nenhum relatório analítico gerado",
  not_finalized: "Versão ainda não finalizada pelo médico responsável",
  pending_presentation: "Apresentação pendente",
  discussion_pending: "Apresentação registrada; discussão pendente",
  presented_and_discussed: "Apresentação e discussão registradas",
};

export type ReportEventLike = {
  id: string;
  reportId: string;
  kind: "finalized" | "presented" | "discussed" | "voided";
  cipaSituation: CipaSituation | null;
  voidsId: string | null;
  recordedAt: string;
};

export type ReportPresentationSummary = {
  state: ReportPresentationState;
  /** Situação da CIPA na última apresentação vigente (null sem apresentação). */
  cipaSituation: CipaSituation | null;
  /** Só com CIPA que participou ou ausência verificada dá para declarar a exigência atendida. */
  cipaRequirementMet: boolean;
  /** Versão anterior apresentada, a vigente não: nova versão exige nova apresentação. */
  previousVersionPresented: boolean;
};

/** Situação da versão vigente a partir dos eventos (registros corrigidos não contam). */
export function summarizeReportPresentation(
  events: ReportEventLike[],
  currentReportId: string | null,
): ReportPresentationSummary {
  const voided = new Set(events.filter((e) => e.kind === "voided").map((e) => e.voidsId));
  const effective = events.filter((e) => e.kind !== "voided" && !voided.has(e.id));
  const current = effective.filter((e) => e.reportId === currentReportId);
  const finalized = current.some((e) => e.kind === "finalized");
  const presentations = current
    .filter((e) => e.kind === "presented")
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const discussed = current.some((e) => e.kind === "discussed");
  const state: ReportPresentationState = !currentReportId
    ? "no_report"
    : !finalized
      ? "not_finalized"
      : !presentations.length
        ? "pending_presentation"
        : !discussed
          ? "discussion_pending"
          : "presented_and_discussed";
  const cipaSituation = finalized ? (presentations.at(-1)?.cipaSituation ?? null) : null;
  return {
    state,
    cipaSituation,
    cipaRequirementMet:
      cipaSituation === "participated" || cipaSituation === "not_constituted",
    previousVersionPresented:
      !presentations.length &&
      effective.some((e) => e.kind === "presented" && e.reportId !== currentReportId),
  };
}
