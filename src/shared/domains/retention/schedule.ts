import { z } from "zod";

import { addDays, addMonths } from "@/shared/domains/medicine/nr7-schedule-rules";
import { optionalIsoDate } from "@/shared/domains/pgr/form-fields";

import type {
  RetentionCategory,
  RetentionCategoryTerm,
  RetentionPolicyState,
  RetentionStartingPoint,
} from "./policy";

export type RetentionMarkers = Partial<Record<RetentionStartingPoint, string>>;

export const retentionMarkersSchema = z.object({
  contract_end: optionalIsoDate,
  company_closure: optionalIsoDate,
  document_issue: optionalIsoDate,
  employee_termination: optionalIsoDate,
});

export type RetentionScheduleRow = {
  category: RetentionCategory;
  startingPoint: RetentionStartingPoint;
  retentionMonths: number;
  startedOn: string | null;
  eligibleOn: string | null;
  notices: { daysBefore: number; on: string }[];
};

export type DiscardGate =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "policy_not_approved"
        | "starting_point_unknown"
        | "retention_period_running";
    };

function scheduleRow(
  term: RetentionCategoryTerm,
  noticeDaysBefore: readonly number[],
  markers: RetentionMarkers,
): RetentionScheduleRow {
  const startedOn = markers[term.startingPoint] ?? null;
  const eligibleOn = startedOn ? addMonths(startedOn, term.retentionMonths) : null;
  return {
    ...term,
    startedOn,
    eligibleOn,
    notices: eligibleOn
      ? noticeDaysBefore.map((daysBefore) => ({
          daysBefore,
          on: addDays(eligibleOn, -daysBefore),
        }))
      : [],
  };
}

export function computeRetentionSchedule(
  terms: {
    categories: readonly RetentionCategoryTerm[];
    noticeDaysBefore: readonly number[];
  },
  markers: RetentionMarkers,
): RetentionScheduleRow[] {
  return terms.categories.map((term) =>
    scheduleRow(term, terms.noticeDaysBefore, markers),
  );
}

export function discardGate(
  state: RetentionPolicyState,
  row: Pick<RetentionScheduleRow, "eligibleOn">,
  today: string,
): DiscardGate {
  if (state.status !== "approved")
    return { allowed: false, reason: "policy_not_approved" };
  if (!row.eligibleOn) return { allowed: false, reason: "starting_point_unknown" };
  if (today < row.eligibleOn)
    return { allowed: false, reason: "retention_period_running" };
  return { allowed: true };
}

export const DISCARD_BLOCK_LABELS: Record<
  Exclude<DiscardGate, { allowed: true }>["reason"],
  string
> = {
  policy_not_approved: "Bloqueado: não há política de guarda aprovada.",
  starting_point_unknown: "Bloqueado: marco inicial não informado.",
  retention_period_running: "Bloqueado: o prazo de guarda ainda não terminou.",
};

export function discardGateLabel(gate: DiscardGate): string {
  return gate.allowed
    ? "Prazo cumprido. O descarte continua manual e depende da autorização registrada na política."
    : DISCARD_BLOCK_LABELS[gate.reason];
}
