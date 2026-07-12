import {
  measureStateLabel,
  type MeasureState,
} from "@/shared/domains/pgr/control-measure";

const STATE_CLASS: Record<MeasureState, string> = {
  without_plan: "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
  planned: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  overdue: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

/** Badge do estado derivado (Sem plano / Planejada / Vencida) — apresentação apenas. */
export function MeasureStateBadge({ state }: { state: MeasureState }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_CLASS[state]}`}
    >
      {measureStateLabel(state)}
    </span>
  );
}
