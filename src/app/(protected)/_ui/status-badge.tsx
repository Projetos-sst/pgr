export type StatusTone = "green" | "amber" | "red" | "neutral";

/*
 * Pílula de status do redesign: ponto colorido + rótulo, fundo translúcido na
 * mesma matiz do texto. Transversal — qualquer listagem com estado (inspeções,
 * ordens de serviço, incidentes) consome esta primitive em vez de recriar a
 * pílula na tela.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  green: "bg-accent-green/15 text-accent-green",
  amber: "bg-accent-amber/20 text-accent-amber-strong",
  red: "bg-danger/15 text-danger",
  neutral: "bg-text-subtle/15 text-text-muted",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  green: "bg-accent-green",
  amber: "bg-accent-amber-strong",
  red: "bg-danger",
  neutral: "bg-text-subtle",
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      className={`rounded-pill inline-flex w-fit items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {label}
    </span>
  );
}
