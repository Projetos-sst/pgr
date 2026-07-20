import { z } from "zod";

import { optionalString, requiredString } from "@/shared/domains/pgr/form-fields";
import type {
  PsychosocialCampaign,
  PsychosocialCampaignStatus,
  PsychosocialQuestion,
  PsychosocialQuestionTypeValue,
} from "@/shared/db/schema";

// Reexport client-safe (o barrel do schema é bloqueado nas páginas/componentes).
export type {
  PsychosocialCampaign,
  PsychosocialQuestion,
  PsychosocialRisk,
} from "@/shared/db/schema";

export const campaignStatusSchema = z.enum(["draft", "active", "closed", "archived"]);
export const questionTypeSchema = z.enum(["likert", "multiple_choice", "free_text"]);

export const CAMPAIGN_STATUS_LABELS: Record<PsychosocialCampaignStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  closed: "Encerrada",
  archived: "Arquivada",
};

export function campaignStatusLabel(value: string): string {
  return CAMPAIGN_STATUS_LABELS[value as PsychosocialCampaignStatus] ?? value;
}

export const QUESTION_TYPE_LABELS: Record<PsychosocialQuestionTypeValue, string> = {
  likert: "Escala Likert (1–5)",
  multiple_choice: "Múltipla escolha",
  free_text: "Texto livre",
};

export function questionTypeLabel(value: string): string {
  return QUESTION_TYPE_LABELS[value as PsychosocialQuestionTypeValue] ?? value;
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida (YYYY-MM-DD)" });

const uuid = z.string().uuid({ message: "Identificador inválido" });

export const campaignInputSchema = z
  .object({
    name: requiredString("Nome da campanha é obrigatório"),
    companyId: uuid,
    workUnitId: uuid,
    startsAt: dateString.nullable().optional(),
    endsAt: dateString.nullable().optional(),
    themeColor: optionalString,
    coverPath: optionalString,
    workerDescription: optionalString,
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, {
    message: "A data fim deve ser igual ou posterior à data início.",
    path: ["endsAt"],
  });
export type CampaignInput = z.input<typeof campaignInputSchema>;
export type CampaignValues = z.output<typeof campaignInputSchema>;

// Registro de risco psicossocial no PGR: o GES é escolhido pelo usuário e chega
// como texto cru — precisa ser uuid válido antes de tocar o repositório (evita
// que uma string malformada vire SQLSTATE 22P02 cru → 500).
export const registerRiskInPgrSchema = z.object({
  gesId: uuid,
});
export type RegisterRiskInPgrInput = z.input<typeof registerRiskInPgrSchema>;

export const questionInputSchema = z.object({
  text: requiredString("Texto da pergunta é obrigatório"),
  questionType: questionTypeSchema,
  // Opções da múltipla escolha (uma por linha); ignoradas nos demais tipos.
  options: optionalString,
});
export type QuestionInput = z.input<typeof questionInputSchema>;
export type QuestionValues = z.output<typeof questionInputSchema>;

// Regra de status: campanha sem perguntas não pode ser ativada.
export function canActivateCampaign(questionCount: number): boolean {
  return questionCount > 0;
}

// Transições de status válidas.
const STATUS_TRANSITIONS: Record<
  PsychosocialCampaignStatus,
  PsychosocialCampaignStatus[]
> = {
  draft: ["active", "archived"],
  active: ["closed", "archived"],
  closed: ["active", "archived"],
  archived: [],
};

export function canTransitionStatus(
  from: PsychosocialCampaignStatus,
  to: PsychosocialCampaignStatus,
): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export type CampaignListItem = {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  companyName: string | null;
  workUnitName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  questionCount: number;
};

export function toCampaignListItem(row: {
  id: string;
  name: string;
  status: string;
  companyName: string | null;
  workUnitName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  questionCount: number;
}): CampaignListItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    statusLabel: campaignStatusLabel(row.status),
    companyName: row.companyName,
    workUnitName: row.workUnitName,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    questionCount: row.questionCount,
  };
}

export type CampaignWithQuestions = {
  campaign: PsychosocialCampaign;
  questions: PsychosocialQuestion[];
};

// Divide as opções (uma por linha) numa lista limpa.
export function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
