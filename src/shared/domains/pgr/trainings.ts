import { z } from "zod";

import type { TrainingCatalog } from "@/shared/db/schema/trainings";
import {
  DUE_WINDOW_DAYS_OPTIONS,
  todayInSaoPaulo,
  type DueWindowDays,
} from "@/shared/dates";

import { optionalString, requiredString, requiredUuid } from "./form-fields";

export type { TrainingCatalog };

export const TRAINING_PERIODICITIES = [
  "annual",
  "biennial",
  "triennial",
  "quinquennial",
  "single",
] as const;

export const trainingPeriodicitySchema = z.enum(TRAINING_PERIODICITIES, {
  error: "Periodicidade inválida",
});

export type TrainingPeriodicity = (typeof TRAINING_PERIODICITIES)[number];

/** Rótulos pt-BR das periodicidades (enum em inglês no banco → UI em pt-BR). */
const PERIODICITY_LABELS: Record<TrainingPeriodicity, string> = {
  annual: "Anual",
  biennial: "Bianual",
  triennial: "Trienal",
  quinquennial: "Quinquenal",
  single: "Única",
};

export function trainingPeriodicityLabel(periodicity: TrainingPeriodicity): string {
  return PERIODICITY_LABELS[periodicity];
}

/** Validade em meses derivada da periodicidade (coluna "Validade" do redesign). */
const PERIODICITY_MONTHS: Record<Exclude<TrainingPeriodicity, "single">, number> = {
  annual: 12,
  biennial: 24,
  triennial: 36,
  quinquennial: 60,
};

export function trainingValidityLabel(periodicity: string): string {
  if (periodicity === "single") return "Única";
  const m = PERIODICITY_MONTHS[periodicity as Exclude<TrainingPeriodicity, "single">];
  return m ? `${m} meses` : "—";
}

/** Código sequencial por tenant do treinamento ("TR-0201"). */
export function nextTrainingNumber(currentMax: number | null | undefined): number {
  if (currentMax == null || !Number.isFinite(currentMax) || currentMax < 0) return 1;
  return Math.floor(currentMax) + 1;
}

export function formatTrainingCode(n: number): string {
  return `TR-${String(n).padStart(4, "0")}`;
}

const YEARS_TO_ADD: Record<Exclude<TrainingPeriodicity, "single">, number> = {
  annual: 1,
  biennial: 2,
  triennial: 3,
  quinquennial: 5,
};

/**
 * Validade de uma realização (D1) — ÚNICA fonte do cálculo, executada no
 * servidor no momento da escrita (D6: o valor é persistido; mudar a
 * periodicidade do catálogo depois NÃO move realizações passadas).
 * `single → null` (não expira). Date-only: `Date.UTC` rola 29/02 → 01/03 em ano
 * não-bissexto (determinístico).
 */
export function computeValidUntil(
  completedAt: string,
  periodicity: TrainingPeriodicity,
): string | null {
  if (periodicity === "single") return null;
  const [year, month, day] = completedAt.split("-").map(Number);
  const target = new Date(Date.UTC(year + YEARS_TO_ADD[periodicity], month - 1, day));
  return target.toISOString().slice(0, 10);
}

export const TRAINING_STATUSES = ["missing", "expired", "due_soon", "ok"] as const;

export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

/** Rótulos pt-BR do status de treinamento. */
export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  missing: "Ausente",
  expired: "Vencido",
  due_soon: "A vencer",
  ok: "Em dia",
};

/** Último registro do par (funcionário, treinamento) — só a validade importa. */
export type LatestTrainingValidity = { validUntil: string | null };

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Status de um treinamento (D2) — ÚNICA fonte da classificação, consumida por
 * US3 (vencimento) e US4 (conformidade). Date-only (`YYYY-MM-DD`, comparação
 * lexicográfica), fronteiras INCLUSIVAS: vence hoje → ainda não vencido
 * (`due_soon`); vence exatamente em hoje+janela → `due_soon`.
 */
export function classifyTrainingStatus(
  latest: LatestTrainingValidity | null,
  { today, dueWindowDays }: { today: string; dueWindowDays: number },
): TrainingStatus {
  if (!latest) return "missing";
  if (latest.validUntil === null) return "ok";
  if (latest.validUntil < today) return "expired";
  if (latest.validUntil <= addDays(today, dueWindowDays)) return "due_soon";
  return "ok";
}

/**
 * Mapeamento canônico do filtro de janela (US3/US4) para D2: `dueWithinDays`
 * (nome no filtro/API) é repassado VERBATIM como `dueWindowDays` de
 * `classifyTrainingStatus` — mesmo valor em dias, nomes distintos por camada.
 * Para linhas COM registro (o `missing` da US4 é decidido antes, pela ausência).
 */
export function statusForDueWindow(
  validUntil: string | null,
  { today, dueWithinDays }: { today: string; dueWithinDays: number },
): TrainingStatus {
  return classifyTrainingStatus({ validUntil }, { today, dueWindowDays: dueWithinDays });
}

/** Janelas de vencimento — canônico em `@/shared/dates`; re-export para compat. */
export { DUE_WINDOW_DAYS_OPTIONS, type DueWindowDays };

export function parseDueWindowDays(value: unknown): DueWindowDays {
  const parsed = Number(value);
  return (DUE_WINDOW_DAYS_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as DueWindowDays)
    : 30;
}

export const trainingCatalogInputSchema = z.object({
  name: requiredString("Nome é obrigatório"),
  referenceNorm: optionalString,
  workloadHours: z.coerce
    .number({ error: "Carga horária é obrigatória" })
    .int("Carga horária deve ser um número inteiro")
    .positive("Carga horária deve ser maior que zero"),
  periodicity: trainingPeriodicitySchema,
  isActive: z.coerce.boolean().optional(), // default true no repositório
  description: optionalString,
});

export type TrainingCatalogInput = z.input<typeof trainingCatalogInputSchema>;
export type TrainingCatalogValues = z.output<typeof trainingCatalogInputSchema>;

// Data de realização: calendário válido e não-futura (vs. hoje em America/Sao_Paulo).
const completedAtSchema = z.iso
  .date("Data inválida (use AAAA-MM-DD)")
  .refine((value) => value <= todayInSaoPaulo(), {
    message: "Data de realização não pode ser no futuro",
  });

/** `valid_until` NÃO entra no input — é calculado no servidor por D1. */
export const trainingRecordInputSchema = z.object({
  employeeId: requiredUuid("Funcionário é obrigatório"),
  trainingId: requiredUuid("Treinamento é obrigatório"),
  completedAt: completedAtSchema,
  certificatePath: optionalString,
});

export type TrainingRecordInput = z.input<typeof trainingRecordInputSchema>;
export type TrainingRecordValues = z.output<typeof trainingRecordInputSchema>;

export const jobRoleRequiredTrainingInputSchema = z.object({
  jobRoleId: requiredUuid("Função é obrigatória"),
  trainingId: requiredUuid("Treinamento é obrigatório"),
});

export type JobRoleRequiredTrainingInput = z.input<
  typeof jobRoleRequiredTrainingInputSchema
>;
export type JobRoleRequiredTrainingValues = z.output<
  typeof jobRoleRequiredTrainingInputSchema
>;

/** Opções (id + nome + periodicidade) para selects de US2/US4. */
export type TrainingCatalogOption = Pick<TrainingCatalog, "id" | "name" | "periodicity">;

/** Vínculo função → treinamento obrigatório com os dados do catálogo (US4). */
export type RequiredTrainingRow = {
  id: string;
  jobRoleId: string;
  trainingId: string;
  trainingName: string;
  periodicity: TrainingPeriodicity;
};

/** Linha do controle de vencimento (US3) e da conformidade (US4). */
export type TrainingStatusRow = {
  employeeId: string;
  employeeName: string;
  trainingId: string;
  trainingName: string;
  /** `null` quando o obrigatório nunca foi realizado (`missing`, US4). */
  completedAt: string | null;
  validUntil: string | null;
  status: TrainingStatus;
};

/** Resumo para o dashboard (US3, D7 — sem cron/notificação). */
export type TrainingDueSummary = { expired: number; dueSoon: number };
