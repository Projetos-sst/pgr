import {
  measureStateLabel,
  type MeasureState,
} from "@/shared/domains/pgr/control-measure";

const STATE_CLASS: Record<MeasureState, string> = {
  without_plan: "bg-white/60 text-text-muted",
  planned: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
};

/** Badge do estado derivado (Sem plano / Planejada / Vencida) — apresentação apenas. */
export function MeasureStateBadge({ state }: { state: MeasureState }) {
  return (
    <span
      className={`rounded-pill px-2 py-0.5 text-xs font-medium ${STATE_CLASS[state]}`}
    >
      {measureStateLabel(state)}
    </span>
  );
}
