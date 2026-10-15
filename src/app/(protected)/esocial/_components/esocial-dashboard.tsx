import type { EsocialDashboard } from "@/shared/domains/esocial/events";

import { StatusBadge, type StatusTone } from "../../_ui/data-list";

/*
 * Painel do eSocial (#218). Tudo aqui é DERIVADO de `esocial_events` por
 * agregação — nenhum número é persistido nem fabricado. "Conformidade" é `null`
 * quando nenhum evento teve veredito ainda e a UI mostra "—" em vez de 0%/100%.
 */

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  pending: "amber",
  sent: "indigo",
  accepted: "green",
  rejected: "red",
  error: "red",
};

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "indigo" | "amber" | "red" | "green";
}) {
  const color = {
    indigo: "text-primary",
    amber: "text-accent-amber-strong",
    red: "text-danger",
    green: "text-accent-green",
  }[tone];
  return (
    <div className="glass-card rounded-[20px] p-5">
      <div className="text-text-subtle font-mono text-[10px] tracking-[0.12em] uppercase">
        {label}
      </div>
      <div
        className={`mt-2 text-[32px] leading-none font-extrabold tabular-nums ${color}`}
      >
        {value}
      </div>
      <div className="text-text-subtle mt-1.5 text-[11px] font-medium">{hint}</div>
    </div>
  );
}

export function EsocialDashboardPanel({ data }: { data: EsocialDashboard }) {
  const maxType = Math.max(1, ...data.byType.map((t) => t.count));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Transmitidos"
          value={String(data.transmitted)}
          hint="Enviados ao eSocial"
          tone="indigo"
        />
        <Kpi
          label="Pendentes"
          value={String(data.pending)}
          hint="Aguardando envio"
          tone="amber"
        />
        <Kpi
          label="Com erro"
          value={String(data.failed)}
          hint="Rejeitados ou com erro"
          tone="red"
        />
        <Kpi
          label="Conformidade"
          value={data.conformityPercent === null ? "—" : `${data.conformityPercent}%`}
          hint={
            data.conformityPercent === null
              ? "Sem eventos com retorno"
              : "Aceitos sobre eventos com retorno"
          }
          tone="green"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="glass-card rounded-[20px] p-6">
          <h2 className="text-primary mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
            Eventos por Tipo
          </h2>
          <div className="flex flex-col gap-3">
            {data.byType.map((t) => (
              <div key={t.eventType} className="flex items-center gap-3">
                <span className="text-primary w-[62px] shrink-0 font-mono text-[13px] font-semibold">
                  {t.eventType}
                </span>
                <span className="text-text-muted min-w-0 flex-1 truncate text-[13px]">
                  {t.description}
                </span>
                <span
                  aria-hidden
                  className="bg-primary/15 hidden h-1.5 w-24 overflow-hidden rounded-full sm:block"
                >
                  <span
                    className="bg-primary block h-full rounded-full"
                    style={{ width: `${Math.round((t.count / maxType) * 100)}%` }}
                  />
                </span>
                <span className="text-text w-8 shrink-0 text-right text-[13px] font-extrabold tabular-nums">
                  {t.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-[20px] p-6">
          <h2 className="text-primary mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
            Eventos recentes
          </h2>
          {data.recent.length === 0 ? (
            <p className="text-text-subtle text-[13px]">
              Nenhum evento registrado ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.recent.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 border-b border-[rgba(120,120,150,0.1)] pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-text truncate text-[13px] font-semibold">
                      <span className="text-primary font-mono">{e.eventType}</span>
                      {e.employeeName ? ` · ${e.employeeName}` : ` · ${e.description}`}
                    </div>
                    <div className="text-text-subtle font-mono text-[11px]">
                      {e.createdAt.slice(0, 10)}
                    </div>
                  </div>
                  <StatusBadge tone={STATUS_TONE[e.status] ?? "neutral"}>
                    {e.statusLabel}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
