import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";

export const PROVISIONAL_TRIAL_POLICY = { days: 15, requiresCard: false } as const;

export const EMISSION_BLOCKED_MESSAGE =
  "A emissão final do PGR fica disponível após a contratação. A prévia continua liberada.";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialStatus = "active" | "expired" | "converted";

export type TrialWindowRecord = {
  endsAt: Date;
  convertedAt: Date | null;
};

export type EmissionAccess = { allowed: true } | { allowed: false; reason: string };

export const trialInputSchema = z
  .object({ companyId: requiredUuid("Empresa inválida.") })
  .strict();
export type TrialInput = z.infer<typeof trialInputSchema>;

const pageNumber = z.number().int().positive().optional();

export const trialFiltersSchema = z.object({
  page: pageNumber,
  pageSize: pageNumber,
});
export type TrialFilters = z.infer<typeof trialFiltersSchema>;

export const trialCompanyIdSchema = requiredUuid("Empresa inválida.");

export function trialWindow(startedAt: Date, days: number): { endsAt: Date } {
  return { endsAt: new Date(startedAt.getTime() + days * DAY_MS) };
}

export function trialStatus(trial: TrialWindowRecord, now: Date): TrialStatus {
  if (trial.convertedAt) return "converted";
  return now.getTime() >= trial.endsAt.getTime() ? "expired" : "active";
}

export function emissionAccess(input: {
  trial: TrialWindowRecord | null;
  hasPaidPgr: boolean;
  now: Date;
}): EmissionAccess {
  if (!input.trial || input.hasPaidPgr) return { allowed: true };
  if (trialStatus(input.trial, input.now) === "converted") return { allowed: true };
  return { allowed: false, reason: EMISSION_BLOCKED_MESSAGE };
}
