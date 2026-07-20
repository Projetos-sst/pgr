import type { DocumentValidityStatus } from "@/shared/domains/documents/validity";

import { VALIDITY_LABELS } from "./format";

const STATUS_CLASSES: Record<DocumentValidityStatus, string> = {
  expired: "bg-red-100 text-red-800 border border-red-300",
  due_soon: "bg-amber-100 text-amber-800 border border-amber-300",
  ok: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  no_expiry: "glass-panel text-text-subtle border border-white/60",
};

export function ValidityBadge({ status }: { status: DocumentValidityStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {VALIDITY_LABELS[status]}
    </span>
  );
}
