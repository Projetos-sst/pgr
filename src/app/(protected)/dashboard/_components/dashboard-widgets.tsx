import Link from "next/link";

import type { BarSegment } from "@/shared/domains/platform/dashboard";

// Promovido para `_ui/stat-card.tsx` (Medicina reutiliza); reexport mantém os importadores.
export { StatCard } from "../../_ui/stat-card";

const CATEGORY_COLORS: Record<string, string> = {
  physical: "#5b63f5", // Físico - Indigo
  chemical: "#a78bfa", // Químico - Purple
  ergonomic: "#38bdf8", // Ergonômico - Sky blue
  biological: "#2dd4bf", // Biológico - Teal
  accident: "#f5a524", // Acidente - Amber
};

export function RiskCategoryChart({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-5 rounded-[18px] p-[22px]">
      <div className="flex items-center gap-2 text-[15px] font-bold text-[#1b1f2e]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5b63f5"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z" />
        </svg>
        Riscos por Categoria
      </div>

      {total === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-[12px] p-8 text-center">
          <p className="text-sm text-[#8c91a8]">Sem dados de riscos registrados ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {segments.map((s) => {
            const color = CATEGORY_COLORS[s.key] ?? "#5b63f5";
            return (
              <div key={s.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#1b1f2e]">{s.label}</span>
                  <span className="font-mono text-[#797e96] tabular-nums">{s.count}</span>
                </div>
                <div className="h-[9px] w-full overflow-hidden rounded-[6px] bg-[#5b63f5]/10">
                  <div
                    className="h-full rounded-[6px] transition-all duration-500"
                    style={{
                      width: `${Math.max(s.percent, s.count > 0 ? 5 : 0)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ActionPlanDonutChart({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-5 rounded-[18px] p-[22px]">
        <div className="flex items-center gap-2 text-[15px] font-bold text-[#1b1f2e]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5b63f5"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <rect x="5" y="4" width="14" height="17" rx="2" />
            <path d="M9 9h6M9 13h6" />
          </svg>
          Planos de Ação
        </div>
        <div className="glass-panel flex flex-col items-center justify-center rounded-[12px] p-8 text-center">
          <p className="text-sm text-[#8c91a8]">Sem planos de ação registrados ainda.</p>
        </div>
      </section>
    );
  }

  // Real data proportions
  const colors = ["#2dd4bf", "#5b63f5", "#f5a524", "#38bdf8", "#a78bfa"];
  const slices: string[] = [];
  let cumPct = 0;
  for (let idx = 0; idx < segments.length; idx++) {
    const pct = (segments[idx].count / total) * 100;
    const start = cumPct;
    cumPct += pct;
    slices.push(`${colors[idx % colors.length]} ${start}% ${cumPct}%`);
  }

  const gradient = `conic-gradient(${slices.join(", ")})`;

  return (
    <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-5 rounded-[18px] p-[22px]">
      <div className="flex items-center gap-2 text-[15px] font-bold text-[#1b1f2e]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5b63f5"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 9h6M9 13h6" />
        </svg>
        Planos de Ação
      </div>

      <div className="flex items-center justify-between gap-6 py-1 sm:gap-8">
        <div
          className="relative flex h-[148px] w-[148px] shrink-0 items-center justify-center rounded-full"
          style={{ background: gradient }}
        >
          <div className="flex h-[96px] w-[96px] flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(91,99,245,0.12)]">
            <span className="text-2xl font-extrabold text-[#1b1f2e]">{total}</span>
            <span className="text-[10px] text-[#9095ad]">total</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3 text-xs sm:text-[13px]">
          {segments.map((s, idx) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <span className="truncate font-semibold text-[#1b1f2e]">{s.label}</span>
              </div>
              <span className="ml-2 font-mono text-[#797e96] tabular-nums">
                {s.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServiceOrderDonutChart({
  summary,
}: {
  summary?: { signed: number; pending: number; refused: number; total: number };
}) {
  if (!summary || summary.total === 0) {
    return (
      <section className="glass-card flex flex-col gap-5 rounded-[18px] p-[22px]">
        <div className="flex items-center gap-2 text-[15px] font-bold text-[#1b1f2e]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5b63f5"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v9l6 3" />
          </svg>
          Status de OS
        </div>
        <div className="glass-panel flex flex-col items-center justify-center rounded-[12px] p-8 text-center">
          <p className="text-sm text-[#8c91a8]">
            Sem ordens de serviço registradas ainda.
          </p>
        </div>
      </section>
    );
  }

  const sPct = (summary.signed / summary.total) * 100;
  const pPct = (summary.pending / summary.total) * 100;

  const gradient = `conic-gradient(#2dd4bf 0% ${sPct}%, #38bdf8 ${sPct}% ${sPct + pPct}%, #f5a524 ${sPct + pPct}% 100%)`;

  return (
    <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-5 rounded-[18px] p-[22px]">
      <div className="flex items-center gap-2 text-[15px] font-bold text-[#1b1f2e]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5b63f5"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v9l6 3" />
        </svg>
        Status de OS
      </div>

      <div className="flex items-center justify-between gap-6 py-1 sm:gap-8">
        <div
          className="relative flex h-[148px] w-[148px] shrink-0 items-center justify-center rounded-full"
          style={{ background: gradient }}
        >
          <div className="flex h-[96px] w-[96px] flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(91,99,245,0.12)]">
            <span className="text-2xl font-extrabold text-[#1b1f2e]">
              {summary.total}
            </span>
            <span className="text-[10px] text-[#9095ad]">ordens</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3.5 text-xs sm:text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#2dd4bf]" />
              <span className="font-semibold text-[#1b1f2e]">Assinadas</span>
            </div>
            <span className="ml-2 font-mono text-[#797e96] tabular-nums">
              {summary.signed}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#38bdf8]" />
              <span className="font-semibold text-[#1b1f2e]">Pendentes</span>
            </div>
            <span className="ml-2 font-mono text-[#797e96] tabular-nums">
              {summary.pending}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#f5a524]" />
              <span className="font-semibold text-[#1b1f2e]">Recusadas</span>
            </div>
            <span className="ml-2 font-mono text-[#797e96] tabular-nums">
              {summary.refused}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function IncidentVerticalChart({
  summary,
}: {
  summary?: {
    open: number;
    inAnalysis: number;
    resolved: number;
    archived: number;
    total: number;
  };
}) {
  if (!summary || summary.total === 0) {
    return (
      <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-5 rounded-[18px] p-[22px]">
        <div className="flex items-center gap-2 text-[15px] font-bold text-[#1b1f2e]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5b63f5"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7" />
          </svg>
          Status de Incidentes
        </div>
        <div className="glass-panel flex flex-col items-center justify-center rounded-[12px] p-8 text-center">
          <p className="text-sm text-[#8c91a8]">Sem incidentes registrados ainda.</p>
        </div>
      </section>
    );
  }

  const maxVal = Math.max(
    summary.open,
    summary.inAnalysis,
    summary.resolved,
    summary.archived,
    1,
  );
  const openPct = Math.round((summary.open / maxVal) * 100);
  const inAnalysisPct = Math.round((summary.inAnalysis / maxVal) * 100);
  const resolvedPct = Math.round((summary.resolved / maxVal) * 100);
  const archivedPct = Math.round((summary.archived / maxVal) * 100);

  return (
    <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-5 rounded-[18px] p-[22px]">
      <div className="flex items-center gap-2 text-[15px] font-bold text-[#1b1f2e]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5b63f5"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7" />
        </svg>
        Status de Incidentes
      </div>

      <div className="flex h-[148px] items-end gap-5 px-2">
        <div className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div
            className="w-full rounded-[8px] bg-[#f5a524]"
            style={{ height: `${Math.max(openPct, 10)}%` }}
          />
          <span className="text-[12px] font-semibold text-[#797e96]">Abertos</span>
        </div>
        <div className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div
            className="w-full rounded-[8px] bg-[#38bdf8]"
            style={{ height: `${Math.max(inAnalysisPct, 10)}%` }}
          />
          <span className="text-[12px] font-semibold text-[#797e96]">Em análise</span>
        </div>
        <div className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div
            className="w-full rounded-[8px] bg-[#2dd4bf]"
            style={{ height: `${Math.max(resolvedPct, 10)}%` }}
          />
          <span className="text-[12px] font-semibold text-[#797e96]">Resolvidos</span>
        </div>
        <div className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div
            className="w-full rounded-[8px] bg-[#a78bfa]"
            style={{ height: `${Math.max(archivedPct, 10)}%` }}
          />
          <span className="text-[12px] font-semibold text-[#797e96]">Arquiv.</span>
        </div>
      </div>
    </section>
  );
}

export function PsicossocialBanner() {
  return (
    <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-5 rounded-[18px] p-5 md:flex-row md:items-center md:justify-between md:p-[22px]">
      <div className="flex items-center gap-[22px]">
        <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] bg-[#5b63f5] text-white shadow-[0_8px_20px_rgba(91,99,245,0.35)]">
          <svg
            width="27"
            height="27"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M12 5a4 4 0 0 0-4 4 4 4 0 0 0-1 7 4 4 0 0 0 5 2 4 4 0 0 0 5-2 4 4 0 0 0-1-7 4 4 0 0 0-4-4z" />
            <path d="M12 5v14" />
          </svg>
        </div>
        <div>
          <div className="mb-1 font-mono text-[10px] font-extrabold tracking-[0.1em] text-[#5b63f5]">
            SAÚDE PREVENTIVA
          </div>
          <div className="text-[17px] font-bold text-[#1b1f2e]">
            Monitoramento Psicossocial
          </div>
          <div className="mt-0.5 text-[13px] text-[#797e96]">
            Gerencie o bem-estar e a conformidade de saúde ocupacional da sua equipe.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 self-end md:self-center">
        <Link
          href="/training-compliance"
          className="btn-primary inline-flex h-[44px] shrink-0 items-center justify-center rounded-[12px] px-[20px] text-[13px] font-bold shadow-[0_8px_20px_rgba(91,99,245,0.35)] transition-all hover:scale-[1.02]"
        >
          Conformidade &rarr;
        </Link>
      </div>
    </section>
  );
}

export function PendingPanel({
  items,
}: {
  items: { label: string; count: number; href: string }[];
}) {
  const totalPending = items.reduce((sum, i) => sum + i.count, 0);
  return (
    <section className="glass-card hover-lift animate-fade-slide-up flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#5b63f5]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v9l6 3" />
            </svg>
          </span>
          <h2 className="text-base font-bold tracking-tight text-[#1b1f2e]">
            Pendências e Vencimentos
          </h2>
        </div>
        {totalPending > 0 ? (
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-red-600">
            {totalPending} total
          </span>
        ) : null}
      </div>

      {totalPending === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-[12px] p-8 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent-green)"
            strokeWidth="1.8"
            className="mb-2"
            aria-hidden="true"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-sm font-semibold text-[#1b1f2e]">Tudo em dia!</p>
          <p className="mt-0.5 text-xs text-[#8c91a8]">
            Nenhuma pendência ou vencimento iminente encontrado.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                className="glass-panel group flex items-center justify-between rounded-[12px] p-3.5 text-sm transition-all hover:border-[#5b63f5]/40 hover:bg-white/50"
              >
                <span className="truncate text-xs font-medium text-[#52576e] group-hover:text-[#1b1f2e] sm:text-sm">
                  {item.label}
                </span>
                <span
                  className={
                    item.count > 0
                      ? "ml-2 shrink-0 rounded-full border border-amber-500/25 bg-amber-500/12 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-700"
                      : "font-mono text-xs text-[#8c91a8]"
                  }
                >
                  {item.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
