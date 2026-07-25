import type { DocumentValidityStatus } from "@/shared/domains/documents/validity";

const STATUS_CONFIG: Record<
  DocumentValidityStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  ok: {
    label: "Vigente",
    bg: "bg-[rgba(16,185,129,0.14)]",
    color: "text-[#0e9f6e]",
    dot: "bg-[#0e9f6e]",
  },
  due_soon: {
    label: "A vencer",
    bg: "bg-[rgba(245,165,36,0.16)]",
    color: "text-[#c9820a]",
    dot: "bg-[#c9820a]",
  },
  expired: {
    label: "Vencido",
    bg: "bg-[rgba(229,72,77,0.14)]",
    color: "text-[#d33a3f]",
    dot: "bg-[#d33a3f]",
  },
  no_expiry: {
    label: "Controlado",
    bg: "bg-[rgba(91,99,245,0.12)]",
    color: "text-[#5b63f5]",
    dot: "bg-[#5b63f5]",
  },
};

export function ValidityBadge({ status }: { status: DocumentValidityStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${config.bg} ${config.color} w-fit`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
