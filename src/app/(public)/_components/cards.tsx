import Link from "next/link";

import { Icon } from "./icon";
import {
  AVAILABILITY_LABEL,
  type Availability,
  type IconName,
  type PlatformModule,
} from "../_content/platform";

/* ----------------------------------------------------- selo de disponibilidade */

/**
 * O selo é o que mantém a landing honesta: `planned` nunca pode se parecer com
 * `available`. Usa as cores de status que já existem nos tokens.
 */
export function AvailabilityBadge({ value }: { value: Availability }) {
  const style: Record<Availability, string> = {
    available: "bg-accent-green/12 text-accent-green",
    evolving: "bg-accent-amber/15 text-accent-amber-strong",
    planned: "bg-text-subtle/15 text-text-muted",
  };
  return (
    <span
      className={`rounded-pill inline-flex shrink-0 items-center px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ${style[value]}`}
    >
      {AVAILABILITY_LABEL[value]}
    </span>
  );
}

/* --------------------------------------------------------------- card de área */

const ACCENT = {
  indigo: {
    ring: "group-hover:border-primary/40",
    chip: "bg-primary/10 text-primary-strong",
    link: "text-primary-strong",
    bar: "bg-primary",
  },
  teal: {
    ring: "group-hover:border-accent-teal/45",
    chip: "bg-accent-teal/12 text-accent-teal-strong",
    link: "text-accent-teal-strong",
    bar: "bg-accent-teal",
  },
} as const;

export function AreaCard({
  href,
  eyebrow,
  title,
  promise,
  summary,
  highlights,
  icon,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  promise: string;
  summary: string;
  highlights: readonly string[];
  icon: IconName;
  accent: keyof typeof ACCENT;
}) {
  const tone = ACCENT[accent];
  return (
    <Link
      href={href}
      className={`group hover-lift focus-visible:ring-primary relative flex h-full flex-col overflow-hidden rounded-[18px] border border-white/70 bg-white/70 p-7 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:p-8 ${tone.ring}`}
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${tone.bar}`} />

      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${tone.chip}`}
        >
          <Icon name={icon} className="h-6 w-6" />
        </span>
        <span className="text-text-subtle font-mono text-[10px] tracking-[0.16em] uppercase">
          {eyebrow}
        </span>
      </div>

      <h3 className="text-text mt-6 text-2xl font-extrabold tracking-tight">{title}</h3>
      <p className={`mt-1 text-sm font-semibold ${tone.link}`}>{promise}</p>
      <p className="text-text-muted mt-4 text-[15px] leading-7">{summary}</p>

      <ul className="mt-6 flex flex-col gap-2.5">
        {highlights.map((item) => (
          <li key={item} className="text-text flex items-start gap-2.5 text-sm">
            <Icon name="check" className={`mt-0.5 h-4 w-4 shrink-0 ${tone.link}`} />
            {item}
          </li>
        ))}
      </ul>

      <span
        className={`mt-auto inline-flex items-center gap-1.5 pt-7 text-sm font-bold ${tone.link}`}
      >
        Conhecer {title}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------- card de benefício */

export function BenefitCard({
  icon,
  title,
  text,
}: {
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-card h-full border border-white/70 bg-white/60 p-6">
      <span className="bg-primary/10 text-primary-strong flex h-10 w-10 items-center justify-center rounded-[12px]">
        <Icon name={icon} />
      </span>
      <h3 className="text-text mt-5 text-base font-bold">{title}</h3>
      <p className="text-text-muted mt-2 text-sm leading-6">{text}</p>
    </div>
  );
}

/* --------------------------------------------------------- card de módulo */

export function ModuleCard({
  item,
  accent = "indigo",
}: {
  item: PlatformModule;
  accent?: keyof typeof ACCENT;
}) {
  const tone = ACCENT[accent];
  const dimmed = item.availability === "planned";
  return (
    <div
      className={`rounded-card flex h-full flex-col border p-5 transition-colors ${
        dimmed
          ? "border-black/5 bg-white/35"
          : "hover:border-primary/25 border-white/70 bg-white/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-[11px] ${
            dimmed ? "bg-text-subtle/12 text-text-subtle" : tone.chip
          }`}
        >
          <Icon name={item.icon} className="h-[18px] w-[18px]" />
        </span>
        <AvailabilityBadge value={item.availability} />
      </div>
      <h3 className="text-text mt-4 text-[15px] font-bold">{item.name}</h3>
      <p className="text-text-muted mt-1.5 text-sm leading-6">{item.description}</p>
    </div>
  );
}

/* ------------------------------------------------------------ passo numerado */

export function StepCard({
  step,
  title,
  text,
  accent = "indigo",
}: {
  step: string;
  title: string;
  text: string;
  accent?: keyof typeof ACCENT;
}) {
  const tone = ACCENT[accent];
  // Sem `<li>` aqui: nas listas o `<li>` e o proprio `Reveal` (`as="li"`), para
  // nao existir elemento intermediario entre `<ol>` e os itens.
  return (
    <div className="relative flex gap-5">
      <span
        className={`font-mono text-2xl font-extrabold tabular-nums ${tone.link} shrink-0`}
        aria-hidden
      >
        {step}
      </span>
      <span className="pb-8">
        <span className="text-text block text-base font-bold">{title}</span>
        <span className="text-text-muted mt-1.5 block text-sm leading-6">{text}</span>
      </span>
    </div>
  );
}
