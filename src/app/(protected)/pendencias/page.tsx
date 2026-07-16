import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { PendingItem } from "@/shared/domains/platform/pending-items";
import { getDashboardSummaryAction } from "@/shared/server/actions/platform/dashboard";
import { getPendingItemsAction } from "@/shared/server/actions/platform/pending-items";

import { EmptyState, PageHeader } from "../_ui/list";

export const dynamic = "force-dynamic";

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className={
        count > 0
          ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
          : "text-text-subtle rounded-full bg-black/5 px-2 py-0.5 text-xs"
      }
    >
      {count}
    </span>
  );
}

function ItemList({ items }: { items: PendingItem[] }) {
  if (items.length === 0) {
    return <p className="text-text-subtle text-sm">Nada nesta categoria.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-white/50">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-center justify-between gap-3 px-1 py-2 text-sm transition-transform hover:-translate-y-0.5"
          >
            <span className="text-text truncate font-medium">{item.primary}</span>
            <span className="text-text-subtle shrink-0 text-xs">{item.secondary}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-text text-sm font-semibold tracking-tight">{title}</h2>
        <CountBadge count={count} />
      </div>
      {children}
    </section>
  );
}

function LinkAll({ href, count }: { href: string; count: number }) {
  return (
    <Link href={href} className="text-text-muted text-sm hover:underline">
      {count > 0 ? `Ver ${count} item(ns) →` : "Ver detalhes →"}
    </Link>
  );
}

export default async function PendenciasPage() {
  await requireOfficeStaffPage();
  const [summaryRes, itemsRes] = await Promise.all([
    getDashboardSummaryAction(),
    getPendingItemsAction(),
  ]);

  if (!summaryRes.ok || !itemsRes.ok) {
    return (
      <div className="flex flex-col gap-6 px-6 py-8">
        <PageHeader title="Pendências e vencimentos" />
        <EmptyState message="Não foi possível carregar as pendências." />
      </div>
    );
  }

  const p = summaryRes.data.pending;
  const items = itemsRes.data;
  const total =
    p.pgrsExpired +
    p.controlsOverdue +
    p.episLowStock +
    p.episPendingReturn +
    p.trainingsExpired +
    p.trainingsDueSoon;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Pendências e vencimentos"
        description="Tudo que precisa de atenção, agrupado por tipo. Cada item leva à origem."
      />

      {total === 0 ? (
        <EmptyState message="Nenhuma pendência. Tudo em dia. ✅" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="PGRs vencidos" count={p.pgrsExpired}>
            <ItemList items={items.pgrsExpired} />
          </Section>
          <Section title="Controles em atraso" count={p.controlsOverdue}>
            <ItemList items={items.controlsOverdue} />
          </Section>
          <Section title="EPIs abaixo do mínimo" count={p.episLowStock}>
            <ItemList items={items.episLowStock} />
          </Section>
          <Section title="EPIs a devolver" count={p.episPendingReturn}>
            <LinkAll href="/epi-returns" count={p.episPendingReturn} />
          </Section>
          <Section title="Treinamentos vencidos" count={p.trainingsExpired}>
            <LinkAll href="/training-expiry" count={p.trainingsExpired} />
          </Section>
          <Section title="Treinamentos a vencer" count={p.trainingsDueSoon}>
            <LinkAll href="/training-expiry" count={p.trainingsDueSoon} />
          </Section>
        </div>
      )}
    </div>
  );
}
