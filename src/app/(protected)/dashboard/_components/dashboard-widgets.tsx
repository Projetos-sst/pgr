import Link from "next/link";

import type { BarSegment } from "@/shared/domains/platform/dashboard";

export function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="glass-card flex flex-col gap-1 px-5 py-4 transition-transform hover:-translate-y-0.5"
    >
      <span className="text-primary-strong text-3xl font-extrabold tracking-tight">
        {value}
      </span>
      <span className="text-text-muted text-sm font-semibold">{label}</span>
    </Link>
  );
}

export function BarChart({ title, segments }: { title: string; segments: BarSegment[] }) {
  const empty = segments.every((s) => s.count === 0);
  return (
    <section className="glass-card flex flex-col gap-3 p-5">
      <h2 className="text-text text-sm font-semibold tracking-tight">{title}</h2>
      {empty ? (
        <p className="text-text-subtle text-sm">Sem dados ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span className="text-text-muted w-32 shrink-0 truncate">{s.label}</span>
              <div className="bg-primary-ring h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${s.percent}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums">{s.count}</span>
            </li>
          ))}
        </ul>
      )}
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
    <section className="glass-card flex flex-col gap-3 p-5">
      <h2 className="text-text text-sm font-semibold tracking-tight">
        Pendências e vencimentos
      </h2>
      {totalPending === 0 ? (
        <p className="text-text-subtle text-sm">Nada pendente. Tudo em dia. ✅</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                className="glass-panel rounded-card hover:text-text flex items-center justify-between px-3 py-2 text-sm transition-colors"
              >
                <span className="text-text-muted">{item.label}</span>
                <span
                  className={
                    item.count > 0
                      ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                      : "text-text-subtle text-xs"
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
