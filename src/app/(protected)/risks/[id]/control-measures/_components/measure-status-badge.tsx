import {
  measureStatusLabel,
  type ControlMeasureStatus,
} from "@/shared/domains/pgr/control-measure";

const STATUS_CLASS: Record<ControlMeasureStatus, string> = {
  maintain: "bg-white/60 text-text-muted",
  introduced: "bg-amber-50 text-amber-700",
  improved: "bg-emerald-50 text-emerald-700",
};

/**
 * Badge do status da medida (Manter/Introduzida/Melhorada, issue #42) — apresentação apenas.
 * `null` quando o risco nunca foi avaliado (regra de status ainda não tem nível pra basear).
 */
export function MeasureStatusBadge({ status }: { status: ControlMeasureStatus | null }) {
  if (!status) {
    return <span className="text-text-subtle text-xs">—</span>;
  }
  return (
    <span
      className={`rounded-pill px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {measureStatusLabel(status)}
    </span>
  );
}
