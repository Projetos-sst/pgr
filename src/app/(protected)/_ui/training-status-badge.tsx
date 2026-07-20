import {
  TRAINING_STATUS_LABELS,
  type TrainingStatus,
} from "@/shared/domains/pgr/trainings";

const STATUS_CLASSES: Record<TrainingStatus, string> = {
  expired: "bg-red-100 text-red-800 border border-red-300",
  due_soon: "bg-amber-100 text-amber-800 border border-amber-300",
  ok: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  missing: "glass-panel text-text-subtle border border-white/60",
};

export function TrainingStatusBadge({ status }: { status: TrainingStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {TRAINING_STATUS_LABELS[status]}
    </span>
  );
}
