import type { ReactNode } from "react";

import type { ActionPlanSummary } from "@/shared/domains/safety/action-plan";

type Tone = "indigo" | "amber" | "green" | "red";

const TINT: Record<Tone, { bg: string; fg: string }> = {
  indigo: { bg: "rgba(91,99,245,0.12)", fg: "#5b63f5" },
  amber: { bg: "rgba(245,165,36,0.14)", fg: "#c9820a" },
  green: { bg: "rgba(16,185,129,0.14)", fg: "#0e9f6e" },
  red: { bg: "rgba(229,72,77,0.14)", fg: "#d33a3f" },
};

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: Tone;
  icon: ReactNode;
}) {
  const t = TINT[tone];
  return (
    <div className="glass-card hover-lift flex items-center gap-4 rounded-[18px] p-5 transition-all">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]"
        style={{ background: t.bg, color: t.fg }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>
        <span
          className="block text-3xl leading-none font-extrabold tracking-[-0.02em]"
          style={{ color: t.fg }}
        >
          {value}
        </span>
        <span className="text-text-subtle mt-1.5 block font-mono text-[10px] tracking-[0.1em] uppercase">
          {label}
        </span>
      </span>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      {children}
    </svg>
  );
}

export function ActionPlanStats({ summary }: { summary: ActionPlanSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <StatCard
        label="Planejados"
        value={summary.planned}
        tone="indigo"
        icon={
          <Icon>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </Icon>
        }
      />
      <StatCard
        label="Em andamento"
        value={summary.inProgress}
        tone="amber"
        icon={
          <Icon>
            <path d="M12 2l10 18H2z" />
            <path d="M12 9v5M12 17h.01" />
          </Icon>
        }
      />
      <StatCard
        label="Concluídos"
        value={summary.completed}
        tone="green"
        icon={
          <Icon>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12l3 3 5-6" />
          </Icon>
        }
      />
      <StatCard
        label="Atrasados"
        value={summary.overdue}
        tone="red"
        icon={
          <Icon>
            <path d="M12 8v4l3 2" />
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          </Icon>
        }
      />
    </div>
  );
}
